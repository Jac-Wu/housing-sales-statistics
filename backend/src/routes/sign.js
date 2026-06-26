import express from 'express';
import db from '../db/index.js';
import {
  getSupplementDifferences,
  recalculateBuildingFrom,
  toInt,
  validateSignSnapshot
} from '../services/sales.js';

const router = express.Router();

router.get('/list', async (req, res, next) => {
  try {
    const { project_id, building_id, date, start_date, end_date } = req.query;
    const conditions = [];
    const params = {};

    if (project_id) {
      conditions.push('dsr.project_id=:project_id');
      params.project_id = project_id;
    }
    if (building_id) {
      conditions.push('dsr.building_id=:building_id');
      params.building_id = building_id;
    }
    if (date) {
      conditions.push('dsr.sign_date=:date');
      params.date = date;
    }
    if (start_date && end_date) {
      conditions.push('dsr.sign_date BETWEEN :start_date AND :end_date');
      params.start_date = start_date;
      params.end_date = end_date;
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const records = db.all(
      `SELECT dsr.*, b.name as building_name, b.total_units as building_total_units
         FROM daily_sign_record dsr
         JOIN building b ON dsr.building_id = b.id
        ${whereSql}
        ORDER BY dsr.sign_date DESC, b.name ASC`,
      params
    );

    res.json({ code: 0, message: 'success', data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/daily', async (req, res, next) => {
  try {
    const { date, project_id } = req.query;
    if (!date) return res.status(400).json({ code: 400, message: '请提供日期参数', errors: [] });

    const records = project_id
      ? db.all(
        `SELECT dsr.*, b.name as building_name, b.total_units as building_total_units
           FROM daily_sign_record dsr
           JOIN building b ON dsr.building_id = b.id
          WHERE dsr.sign_date=:date AND dsr.project_id=:project_id
          ORDER BY b.name ASC`,
        { date, project_id }
      )
      : db.all(
        `SELECT dsr.*, b.name as building_name, b.total_units as building_total_units
           FROM daily_sign_record dsr
           JOIN building b ON dsr.building_id = b.id
          WHERE dsr.sign_date=:date
          ORDER BY b.name ASC`,
        { date }
      );

    const totalSold = records.reduce((sum, row) => sum + toInt(row.derived_sold_units), 0);
    const totalAvailable = records.reduce((sum, row) => sum + toInt(row.available_units), 0);
    const differences = await getSupplementDifferences({ project_id, sign_date: date });

    res.json({
      code: 0,
      message: 'success',
      data: { date, records, total_sold: totalSold, total_available: totalAvailable, supplement_differences: differences }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/previous', async (req, res, next) => {
  try {
    const { building_id, date } = req.query;
    const record = db.get(
      'SELECT * FROM daily_sign_record WHERE building_id=:building_id AND sign_date<:date ORDER BY sign_date DESC, id DESC LIMIT 1',
      { building_id, date }
    );
    res.json({ code: 0, message: 'success', data: record || null });
  } catch (err) {
    next(err);
  }
});

router.get('/derived-sales', async (req, res, next) => {
  try {
    const differences = await getSupplementDifferences(req.query);
    res.json({ code: 0, message: 'success', data: differences });
  } catch (err) {
    next(err);
  }
});

router.post('/add', async (req, res, next) => {
  try {
    const id = await saveSnapshot(req.body);
    res.json({ code: 0, message: '录入成功', data: { id } });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', async (req, res, next) => {
  try {
    const { date, sign_date, project_id, records = [] } = req.body;
    const targetDate = sign_date || date;
    const saved = [];

    for (const record of records) {
      if (!record.building_id) continue;
      const id = await saveSnapshot({ ...record, project_id, sign_date: record.sign_date || targetDate });
      saved.push(id);
    }

    res.json({ code: 0, message: '批量录入成功', data: { saved_count: saved.length, ids: saved } });
  } catch (err) {
    next(err);
  }
});

router.delete('/delete/:id', async (req, res, next) => {
  try {
    const record = db.get('SELECT * FROM daily_sign_record WHERE id=:id', { id: req.params.id });
    if (!record) return res.status(404).json({ code: 404, message: '可售快照不存在', errors: [] });

    db.remove('daily_sign_record', { id: req.params.id });
    await recalculateBuildingFrom(record.building_id);
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

async function saveSnapshot(payload) {
  const {
    project_id,
    building_id,
    sign_date,
    available_units,
    adjustment_units = 0,
    adjustment_reason = '',
    source = 'manual',
    remark = ''
  } = payload;

  const building = db.get('SELECT * FROM building WHERE id=:id', { id: building_id });
  if (!building) {
    const error = new Error('楼栋不存在');
    error.status = 404;
    error.errors = [{ field: 'building_id', message: '楼栋不存在' }];
    throw error;
  }

  const existing = db.get(
    'SELECT * FROM daily_sign_record WHERE building_id=:building_id AND sign_date=:sign_date',
    { building_id, sign_date }
  );
  const validation = await validateSignSnapshot({
    building_id,
    sign_date,
    available_units,
    adjustment_units,
    id: existing?.id
  });

  if (!validation.valid) {
    const error = new Error('网签可售快照校验失败');
    error.status = 422;
    error.errors = validation.errors;
    throw error;
  }

  const data = {
    project_id: project_id || building.project_id,
    building_id,
    sign_date,
    available_units: toInt(available_units),
    adjustment_units: toInt(adjustment_units),
    adjustment_reason,
    source,
    remark,
    updated_at: db.now()
  };

  let id = existing?.id;
  if (existing) {
    db.update('daily_sign_record', data, { id });
  } else {
    id = db.insert('daily_sign_record', { ...data, created_at: db.now() });
  }

  await recalculateBuildingFrom(building_id);
  return id;
}

export default router;
