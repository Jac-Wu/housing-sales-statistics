import express from 'express';
import db from '../db/index.js';
import { getSupplementDifferences, ratio, toInt } from '../services/sales.js';

const router = express.Router();

router.get('/project', async (req, res, next) => {
  try {
    const project = resolveProject(req.query.project_id);
    if (!project) return res.json({ code: 0, message: 'success', data: null });
    const data = await buildProjectStats(project.id);
    res.json({ code: 0, message: 'success', data: { ...project, ...data } });
  } catch (err) {
    next(err);
  }
});

router.get('/building', async (req, res, next) => {
  try {
    const { project_id, sort_by = 'de_ratio', order = 'desc' } = req.query;
    const buildings = project_id
      ? db.all('SELECT * FROM building WHERE project_id=:project_id', { project_id })
      : db.all('SELECT * FROM building');
    const rows = buildings.map((building) => decorateBuildingStat(building, latestSnapshot(building.id)));
    sortRows(rows, sort_by, order);
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/unit-type', async (req, res, next) => {
  try {
    const { building_id, project_id } = req.query;
    let rows;
    if (building_id) {
      rows = unitTypeStatsByWhere('WHERE but.building_id=:building_id', { building_id });
    } else if (project_id) {
      rows = unitTypeStatsByWhere('JOIN building b ON but.building_id = b.id WHERE b.project_id=:project_id', { project_id });
    } else {
      rows = unitTypeStatsByWhere('', {});
    }
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/trend', async (req, res, next) => {
  try {
    const { project_id, start_date, end_date, building_id } = req.query;
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
    if (start_date && end_date) {
      conditions.push('dsr.sign_date BETWEEN :start_date AND :end_date');
      params.start_date = start_date;
      params.end_date = end_date;
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const records = db.all(
      `SELECT dsr.sign_date, dsr.available_units, dsr.derived_sold_units, dsr.cumulative_sold_units,
              dsr.building_id, b.name as building_name
         FROM daily_sign_record dsr
         JOIN building b ON dsr.building_id = b.id
        ${whereSql}
        ORDER BY dsr.sign_date ASC, b.name ASC`,
      params
    );
    const byDate = new Map();
    for (const row of records) {
      if (!byDate.has(row.sign_date)) {
        byDate.set(row.sign_date, {
          sign_date: row.sign_date,
          daily_sold_units: 0,
          available_units: 0,
          cumulative_sold_units: 0,
          records: []
        });
      }
      const item = byDate.get(row.sign_date);
      item.daily_sold_units += toInt(row.derived_sold_units);
      item.available_units += toInt(row.available_units);
      item.cumulative_sold_units += toInt(row.cumulative_sold_units);
      item.records.push(row);
    }
    res.json({ code: 0, message: 'success', data: Array.from(byDate.values()) });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const project = resolveProject(req.query.project_id);
    if (!project) return res.json({ code: 0, message: 'success', data: null });
    const stats = await buildProjectStats(project.id);
    res.json({ code: 0, message: 'success', data: stats });
  } catch (err) {
    next(err);
  }
});

router.get('/building-unit-type-matrix', async (req, res, next) => {
  try {
    const { project_id, building_id } = req.query;
    if (!project_id) {
      return res.json({ code: 400, message: 'project_id is required', data: null });
    }

    const buildingConditions = ['b.project_id=:project_id'];
    const params = { project_id };
    if (building_id) {
      buildingConditions.push('b.id=:building_id');
      params.building_id = building_id;
    }
    const buildingWhereSql = `WHERE ${buildingConditions.join(' AND ')}`;

    const buildings = db.all(
      `SELECT b.id, b.name FROM building b ${buildingWhereSql} ORDER BY b.name ASC`,
      params
    );

    const unitTypes = db.all(
      `SELECT DISTINCT ut.id, ut.name
         FROM unit_type ut
         JOIN building_unit_type but ON ut.id = but.unit_type_id
         JOIN building b ON but.building_id = b.id
        WHERE b.project_id=:project_id
        ORDER BY ut.name ASC`,
      { project_id }
    );

    const matrixRecords = db.all(
      `SELECT but.building_id, but.unit_type_id,
              but.total_units, but.sold_units, but.unsold_units
         FROM building_unit_type but
         JOIN building b ON but.building_id = b.id
         ${buildingWhereSql}`,
      params
    );

    const matrix = {};
    for (const record of matrixRecords) {
      const key = `${record.building_id}-${record.unit_type_id}`;
      const total = toInt(record.total_units);
      const sold = toInt(record.sold_units);
      const unsold = toInt(record.unsold_units);
      matrix[key] = {
        total,
        sold,
        unsold,
        de_ratio: `${ratio(sold, total).toFixed(2)}%`,
        de_ratio_value: ratio(sold, total)
      };
    }

    res.json({
      code: 0,
      message: 'success',
      data: {
        buildings,
        unit_types: unitTypes,
        matrix
      }
    });
  } catch (err) {
    next(err);
  }
});

function resolveProject(projectId) {
  return projectId
    ? db.get('SELECT * FROM project WHERE id=:id', { id: projectId })
    : db.get('SELECT * FROM project ORDER BY id ASC LIMIT 1');
}

async function buildProjectStats(projectId) {
  const buildings = db.all('SELECT * FROM building WHERE project_id=:project_id', { project_id: projectId });
  const buildingRanking = buildings
    .map((building) => decorateBuildingStat(building, latestSnapshot(building.id)))
    .sort((a, b) => b.de_ratio_value - a.de_ratio_value);
  const totalUnits = buildingRanking.reduce((sum, item) => sum + toInt(item.total_units), 0);
  const totalSold = buildingRanking.reduce((sum, item) => sum + toInt(item.sold_units), 0);
  const totalAvailable = buildingRanking.reduce((sum, item) => sum + toInt(item.available_units), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todaySold = db.get(
    'SELECT COALESCE(SUM(derived_sold_units), 0) as total FROM daily_sign_record WHERE project_id=:project_id AND sign_date=:today',
    { project_id: projectId, today }
  );
  const differences = await getSupplementDifferences({ project_id: projectId });
  const pending = differences.filter((item) => item.status !== 'completed');

  return {
    project_id: projectId,
    total_units: totalUnits,
    total_sold: totalSold,
    total_available: totalAvailable,
    total_unsold: totalAvailable,
    de_ratio: `${ratio(totalSold, totalUnits).toFixed(2)}%`,
    today_sold: toInt(todaySold?.total),
    today_signed: toInt(todaySold?.total),
    pending_supplement_count: pending.length,
    building_ranking: buildingRanking,
    unit_type_stats: unitTypeStatsByWhere('JOIN building b ON but.building_id = b.id WHERE b.project_id=:project_id', { project_id: projectId }),
    supplement_differences: differences
  };
}

function unitTypeStatsByWhere(whereSql, params) {
  const rows = db.all(
    `SELECT ut.id, ut.name,
            COALESCE(SUM(but.total_units), 0) as total_units,
            COALESCE(SUM(but.sold_units), 0) as sold_units,
            COALESCE(SUM(but.unsold_units), 0) as unsold_units
       FROM building_unit_type but
       JOIN unit_type ut ON but.unit_type_id = ut.id
       ${whereSql}
      GROUP BY ut.id, ut.name
      ORDER BY ut.name ASC`,
    params
  );
  return rows.map((row) => ({
    ...row,
    total: row.total_units,
    sold: row.sold_units,
    unsold: row.unsold_units,
    de_ratio: `${ratio(row.sold_units, row.total_units).toFixed(2)}%`
  }));
}

function latestSnapshot(buildingId) {
  return db.get(
    'SELECT * FROM daily_sign_record WHERE building_id=:building_id ORDER BY sign_date DESC, id DESC LIMIT 1',
    { building_id: buildingId }
  );
}

function decorateBuildingStat(building, snapshot = null) {
  const availableUnits = snapshot ? toInt(snapshot.available_units) : toInt(building.unsold_units);
  const soldUnits = snapshot ? toInt(snapshot.cumulative_sold_units) : toInt(building.sold_units);
  const deRatio = ratio(soldUnits, building.total_units);
  return {
    id: building.id,
    name: building.name,
    total_units: toInt(building.total_units),
    sold_units: soldUnits,
    unsold_units: availableUnits,
    available_units: availableUnits,
    today_sold_units: snapshot ? toInt(snapshot.derived_sold_units) : 0,
    latest_sign_date: snapshot?.sign_date || null,
    de_ratio: `${deRatio.toFixed(2)}%`,
    de_ratio_value: deRatio
  };
}

function sortRows(rows, sortBy, order) {
  const direction = order === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (sortBy === 'total_units') return (a.total_units - b.total_units) * direction;
    if (sortBy === 'sold_units') return (a.sold_units - b.sold_units) * direction;
    if (sortBy === 'available_units') return (a.available_units - b.available_units) * direction;
    return (a.de_ratio_value - b.de_ratio_value) * direction;
  });
}

export default router;
