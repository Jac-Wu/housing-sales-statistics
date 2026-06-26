import express from 'express';
import db from '../db/index.js';
import {
  getBuildingUnitTypes,
  getSupplementDifferences,
  ratio,
  recalculateBuildingFrom,
  toInt,
  updateProjectTotalUnits
} from '../services/sales.js';

const router = express.Router();

router.get('/list', async (req, res, next) => {
  try {
    const { project_id } = req.query;
    const buildings = project_id
      ? db.all('SELECT * FROM building WHERE project_id=:project_id', { project_id })
      : db.all('SELECT * FROM building');
    const differences = await getSupplementDifferences({ project_id });
    const diffByBuilding = new Map(differences.map((item) => [item.building_id, item.status]));

    // 自然排序：提取数字部分进行排序
    const result = buildings
      .sort((a, b) => {
        const numA = parseInt(a.name, 10);
        const numB = parseInt(b.name, 10);
        // 如果两个都是数字，按数字排序
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        // 如果只有一个是数字，数字排在前面
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        // 都不是数字，按字符串排序
        return a.name.localeCompare(b.name, 'zh-CN');
      })
      .map((building) => {
        const latest = latestSnapshotForBuilding(building.id);
        return decorateBuilding(building, latest, diffByBuilding.get(building.id) || 'completed');
      });

    res.json({ code: 0, message: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const building = db.get('SELECT * FROM building WHERE id=:id', { id: req.params.id });
    if (!building) return res.status(404).json({ code: 404, message: '楼栋不存在', errors: [] });

    const unitTypes = await getBuildingUnitTypes(req.params.id);
    const latest = latestSnapshotForBuilding(req.params.id);
    const differences = await getSupplementDifferences({ building_id: req.params.id });

    res.json({
      code: 0,
      message: 'success',
      data: {
        ...decorateBuilding(building, latest, differences[0]?.status || 'completed'),
        unit_types: unitTypes.map((ut) => ({
          ...ut,
          total: ut.total_units,
          sold: ut.sold_units,
          unsold: ut.unsold_units
        })),
        latest_snapshot: latest,
        supplement_differences: differences
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/create', async (req, res, next) => {
  try {
    const {
      project_id,
      name,
      total_units = 0,
      opened_units = 0,
      sold_units = 0,
      unsold_units,
      status = 'active',
      unit_types = []
    } = req.body;

    if (!project_id || !name) {
      return res.status(400).json({
        code: 400,
        message: '楼盘和楼栋名称不能为空',
        errors: [{ field: 'name', message: '楼盘和楼栋名称不能为空' }]
      });
    }

    const totalUnits = toInt(total_units);
    const soldUnits = toInt(sold_units);
    const availableUnits = unsold_units === undefined ? Math.max(totalUnits - soldUnits, 0) : toInt(unsold_units);
    const id = db.insert('building', {
      project_id,
      name,
      total_units: totalUnits,
      opened_units: toInt(opened_units),
      sold_units: soldUnits,
      unsold_units: availableUnits,
      status,
      created_at: db.now(),
      updated_at: db.now()
    });

    saveBuildingUnitTypes(id, unit_types);
    await updateProjectTotalUnits(project_id);

    res.json({ code: 0, message: '创建成功', data: { id } });
  } catch (err) {
    next(err);
  }
});

router.put('/update/:id', async (req, res, next) => {
  try {
    const building = db.get('SELECT * FROM building WHERE id=:id', { id: req.params.id });
    if (!building) return res.status(404).json({ code: 404, message: '楼栋不存在', errors: [] });

    const {
      name,
      total_units = 0,
      opened_units = 0,
      sold_units = 0,
      unsold_units,
      status = 'active',
      unit_types
    } = req.body;

    const totalUnits = toInt(total_units);
    const soldUnits = toInt(sold_units);
    const availableUnits = unsold_units === undefined ? Math.max(totalUnits - soldUnits, 0) : toInt(unsold_units);

    db.update('building', {
      name,
      total_units: totalUnits,
      opened_units: toInt(opened_units),
      sold_units: soldUnits,
      unsold_units: availableUnits,
      status,
      updated_at: db.now()
    }, { id: req.params.id });

    if (Array.isArray(unit_types)) saveBuildingUnitTypes(req.params.id, unit_types);
    await recalculateBuildingFrom(req.params.id);
    await updateProjectTotalUnits(building.project_id);

    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    next(err);
  }
});

router.delete('/delete/:id', async (req, res, next) => {
  try {
    const building = db.get('SELECT * FROM building WHERE id=:id', { id: req.params.id });
    if (!building) return res.status(404).json({ code: 404, message: '楼栋不存在', errors: [] });

    db.remove('building_unit_type', { building_id: req.params.id });
    db.remove('daily_sign_record', { building_id: req.params.id });
    db.remove('unit_type_sale_record', { building_id: req.params.id });
    db.remove('building', { id: req.params.id });
    await updateProjectTotalUnits(building.project_id);

    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

function decorateBuilding(building, latestSnapshot = null, supplementStatus = null) {
  const availableUnits = latestSnapshot ? toInt(latestSnapshot.available_units) : toInt(building.unsold_units);
  const soldUnits = latestSnapshot ? toInt(latestSnapshot.cumulative_sold_units) : toInt(building.sold_units);
  const deRatio = ratio(soldUnits, building.total_units);

  return {
    ...building,
    sold_units: soldUnits,
    unsold_units: availableUnits,
    available_units: availableUnits,
    latest_sign_date: latestSnapshot?.sign_date || null,
    today_sold_units: latestSnapshot?.derived_sold_units || 0,
    de_ratio: `${deRatio.toFixed(2)}%`,
    de_ratio_value: deRatio,
    supplement_status: supplementStatus || 'none'
  };
}

function latestSnapshotForBuilding(buildingId) {
  return db.get(
    'SELECT * FROM daily_sign_record WHERE building_id=:building_id ORDER BY sign_date DESC, id DESC LIMIT 1',
    { building_id: buildingId }
  );
}

function saveBuildingUnitTypes(buildingId, unitTypes = []) {
  db.remove('building_unit_type', { building_id: buildingId });
  for (const ut of unitTypes.filter((item) => item.unit_type_id)) {
    const totalUnits = toInt(ut.total_units ?? ut.total);
    const soldUnits = toInt(ut.sold_units ?? ut.sold);
    db.insert('building_unit_type', {
      building_id: toInt(buildingId),
      unit_type_id: toInt(ut.unit_type_id),
      total_units: totalUnits,
      sold_units: soldUnits,
      unsold_units: Math.max(totalUnits - soldUnits, 0),
      created_at: db.now(),
      updated_at: db.now()
    });
  }
}

export default router;
