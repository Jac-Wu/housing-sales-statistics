import express from 'express';
import db from '../db/index.js';
import { getSupplementDifferences, toInt } from '../services/sales.js';

const router = express.Router();

router.get('/list', async (req, res, next) => {
  try {
    const { project_id, building_id, sign_date, unit_type_id } = req.query;
    const conditions = [];
    const params = {};
    if (project_id) {
      conditions.push('uts.project_id=:project_id');
      params.project_id = project_id;
    }
    if (building_id) {
      conditions.push('uts.building_id=:building_id');
      params.building_id = building_id;
    }
    if (sign_date) {
      conditions.push('uts.sign_date=:sign_date');
      params.sign_date = sign_date;
    }
    if (unit_type_id) {
      conditions.push('uts.unit_type_id=:unit_type_id');
      params.unit_type_id = unit_type_id;
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const records = db.all(
      `SELECT uts.*, b.name as building_name, ut.name as unit_type_name
         FROM unit_type_sale_record uts
         JOIN building b ON uts.building_id = b.id
         JOIN unit_type ut ON uts.unit_type_id = ut.id
        ${whereSql}
        ORDER BY uts.sign_date DESC, b.name ASC, ut.name ASC`,
      params
    );
    res.json({ code: 0, message: 'success', data: records });
  } catch (err) {
    next(err);
  }
});

router.post('/add', async (req, res, next) => {
  try {
    const id = await saveUnitTypeSale(req.body);
    const differences = await getSupplementDifferences(req.body);
    res.json({ code: 0, message: '保存成功', data: { id, differences } });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', async (req, res, next) => {
  try {
    const { project_id, building_id, sign_date, records = [] } = req.body;
    const saved = [];
    for (const record of records) {
      if (!record.unit_type_id) continue;
      const id = await saveUnitTypeSale({ ...record, project_id, building_id, sign_date });
      saved.push(id);
    }
    const differences = await getSupplementDifferences({ project_id, sign_date, building_id });
    res.json({ code: 0, message: '批量保存成功', data: { saved_count: saved.length, ids: saved, differences } });
  } catch (err) {
    next(err);
  }
});

router.delete('/delete/:id', async (req, res, next) => {
  try {
    db.remove('unit_type_sale_record', { id: req.params.id });
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

router.get('/gaps', async (req, res, next) => {
  try {
    const differences = await getSupplementDifferences(req.query);
    res.json({ code: 0, message: 'success', data: differences.filter((item) => item.status !== 'completed') });
  } catch (err) {
    next(err);
  }
});

router.get('/differences', async (req, res, next) => {
  try {
    const differences = await getSupplementDifferences(req.query);
    res.json({ code: 0, message: 'success', data: differences });
  } catch (err) {
    next(err);
  }
});

async function saveUnitTypeSale(payload) {
  const {
    project_id,
    building_id,
    unit_type_id,
    sign_date,
    sold_units = 0,
    source = 'manual',
    remark = ''
  } = payload;

  if (!project_id || !building_id || !unit_type_id || !sign_date) {
    const error = new Error('楼盘、楼栋、户型和日期不能为空');
    error.status = 400;
    error.errors = [{ field: 'required', message: '楼盘、楼栋、户型和日期不能为空' }];
    throw error;
  }

  const structure = db.get(
    'SELECT * FROM building_unit_type WHERE building_id=:building_id AND unit_type_id=:unit_type_id',
    { building_id, unit_type_id }
  );
  if (!structure) {
    const error = new Error('该楼栋未配置所选户型');
    error.status = 422;
    error.errors = [{ field: 'unit_type_id', message: '该楼栋未配置所选户型' }];
    throw error;
  }

  const sold = toInt(sold_units);
  if (sold < 0) {
    const error = new Error('户型售出套数不能小于 0');
    error.status = 422;
    error.errors = [{ field: 'sold_units', message: '户型售出套数不能小于 0' }];
    throw error;
  }

  const existing = db.get(
    'SELECT * FROM unit_type_sale_record WHERE building_id=:building_id AND unit_type_id=:unit_type_id AND sign_date=:sign_date',
    { building_id, unit_type_id, sign_date }
  );

  const data = { project_id, building_id, unit_type_id, sign_date, sold_units: sold, source, remark, updated_at: db.now() };
  let id = existing?.id;
  if (existing) db.update('unit_type_sale_record', data, { id });
  else id = db.insert('unit_type_sale_record', { ...data, created_at: db.now() });

  refreshBuildingUnitTypeSales(building_id, unit_type_id);
  return id;
}

function refreshBuildingUnitTypeSales(buildingId, unitTypeId) {
  const aggregate = db.get(
    'SELECT COALESCE(SUM(sold_units), 0) as sold FROM unit_type_sale_record WHERE building_id=:building_id AND unit_type_id=:unit_type_id',
    { building_id: buildingId, unit_type_id: unitTypeId }
  );
  const structure = db.get(
    'SELECT * FROM building_unit_type WHERE building_id=:building_id AND unit_type_id=:unit_type_id',
    { building_id: buildingId, unit_type_id: unitTypeId }
  );
  if (!structure) return;

  const sold = toInt(aggregate?.sold);
  const total = toInt(structure.total_units);
  db.update('building_unit_type', {
    sold_units: sold,
    unsold_units: Math.max(total - sold, 0),
    updated_at: db.now()
  }, { id: structure.id });
}

export default router;
