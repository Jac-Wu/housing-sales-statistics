import express from 'express';
import db from '../db/index.js';
import { getBuildingUnitTypes, getSupplementDifferences, toInt } from '../services/sales.js';

const router = express.Router();

router.get('/building/:id', async (req, res, next) => {
  try {
    const result = await checkBuilding(req.params.id);
    if (!result) return res.status(404).json({ code: 404, message: '楼栋不存在', errors: [] });
    res.json({ code: 0, message: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/project', async (req, res, next) => {
  try {
    const { project_id } = req.query;
    const buildings = project_id
      ? db.all('SELECT id FROM building WHERE project_id=:project_id', { project_id })
      : db.all('SELECT id FROM building');
    const results = [];
    for (const building of buildings) {
      const result = await checkBuilding(building.id);
      if (result) results.push(result);
    }
    const differences = await getSupplementDifferences({ project_id });
    for (const diff of differences) {
      if (diff.status === 'completed') continue;
      results.push({
        building_id: diff.building_id,
        building_name: diff.building_name,
        date: diff.sign_date,
        status: diff.status === 'mismatch' ? 'error' : 'warning',
        messages: [
          diff.status === 'mismatch'
            ? `户型补充合计超出楼栋推导售出 ${Math.abs(diff.difference_units)} 套`
            : `户型销售待补充 ${diff.difference_units} 套`
        ],
        suggestion: '进入户型销售补充页核对该楼栋各户型售出套数'
      });
    }
    res.json({ code: 0, message: 'success', data: results });
  } catch (err) {
    next(err);
  }
});

router.get('/daily-sign', async (req, res, next) => {
  try {
    const { project_id, start_date, end_date } = req.query;
    const conditions = [];
    const params = {};
    if (project_id) {
      conditions.push('dsr.project_id=:project_id');
      params.project_id = project_id;
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
        ORDER BY dsr.sign_date ASC`,
      params
    );
    const errors = records
      .filter((record) =>
        toInt(record.available_units) < 0 ||
        toInt(record.available_units) > toInt(record.building_total_units) ||
        toInt(record.derived_sold_units) < 0
      )
      .map((record) => ({
        building_id: record.building_id,
        building_name: record.building_name,
        date: record.sign_date,
        message: '可售套数或推导售出异常'
      }));
    res.json({ code: 0, message: 'success', data: { total_records: records.length, errors, is_valid: errors.length === 0 } });
  } catch (err) {
    next(err);
  }
});

async function checkBuilding(buildingId) {
  const building = db.get('SELECT * FROM building WHERE id=:id', { id: buildingId });
  if (!building) return null;

  const latest = db.get(
    'SELECT * FROM daily_sign_record WHERE building_id=:building_id ORDER BY sign_date DESC, id DESC LIMIT 1',
    { building_id: buildingId }
  );
  const soldUnits = latest ? toInt(latest.cumulative_sold_units) : toInt(building.sold_units);
  const availableUnits = latest ? toInt(latest.available_units) : toInt(building.unsold_units);
  const messages = [];
  let status = 'ok';

  if (soldUnits + availableUnits !== toInt(building.total_units)) {
    messages.push('累计售出 + 可售套数 ≠ 总房源');
    status = 'error';
  }
  if (availableUnits < 0) {
    messages.push('可售套数为负数');
    status = 'error';
  }
  if (soldUnits > toInt(building.total_units)) {
    messages.push('累计售出超过总房源');
    status = 'error';
  }

  const unitTypes = await getBuildingUnitTypes(buildingId);
  const unitTypeTotal = unitTypes.reduce((sum, ut) => sum + toInt(ut.total_units), 0);
  if (unitTypes.length > 0 && unitTypeTotal !== toInt(building.total_units)) {
    messages.push('户型总量不一致');
    if (status !== 'error') status = 'warning';
  }
  if (unitTypes.length === 0 && toInt(building.total_units) > 0) {
    messages.push('楼栋尚未配置户型结构');
    if (status !== 'error') status = 'warning';
  }

  return {
    building_id: building.id,
    building_name: building.name,
    status,
    messages: messages.length > 0 ? messages : ['数据正常'],
    latest_sign_date: latest?.sign_date || null,
    sold_units: soldUnits,
    available_units: availableUnits
  };
}

export default router;
