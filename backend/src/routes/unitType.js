import express from 'express';
import db from '../db/index.js';
import { toInt } from '../services/sales.js';

const router = express.Router();

router.get('/list', async (req, res, next) => {
  try {
    const { project_id } = req.query;
    const unitTypes = project_id
      ? db.all('SELECT * FROM unit_type WHERE project_id=:project_id ORDER BY name ASC', { project_id })
      : db.all('SELECT * FROM unit_type ORDER BY name ASC');
    res.json({ code: 0, message: 'success', data: unitTypes });
  } catch (err) {
    next(err);
  }
});

router.get('/building/:buildingId/options', async (req, res, next) => {
  try {
    const rows = db.all(
      `SELECT ut.id, ut.name, but.total_units, but.sold_units, but.unsold_units
         FROM building_unit_type but
         JOIN unit_type ut ON but.unit_type_id = ut.id
        WHERE but.building_id=:building_id
        ORDER BY ut.name ASC`,
      { building_id: toInt(req.params.buildingId) }
    );
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const unitType = db.get('SELECT * FROM unit_type WHERE id=:id', { id: req.params.id });
    if (!unitType) return res.status(404).json({ code: 404, message: '户型不存在', errors: [] });
    res.json({ code: 0, message: 'success', data: unitType });
  } catch (err) {
    next(err);
  }
});

router.post('/create', async (req, res, next) => {
  try {
    const {
      project_id,
      name,
      room_layout = '',
      area = null,
      description = '',
      status = 'active'
    } = req.body;

    if (!name) {
      return res.status(400).json({
        code: 400,
        message: '户型名称不能为空',
        errors: [{ field: 'name', message: '户型名称不能为空' }]
      });
    }

    const id = db.insert('unit_type', {
      project_id: project_id || null,
      name,
      room_layout,
      area,
      description,
      status,
      created_at: db.now(),
      updated_at: db.now()
    });

    res.json({ code: 0, message: '创建成功', data: { id } });
  } catch (err) {
    next(err);
  }
});

router.put('/update/:id', async (req, res, next) => {
  try {
    const {
      name,
      room_layout = '',
      area = null,
      description = '',
      status = 'active'
    } = req.body;

    db.update('unit_type', {
      name,
      room_layout,
      area,
      description,
      status,
      updated_at: db.now()
    }, { id: req.params.id });

    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    next(err);
  }
});

router.delete('/delete/:id', async (req, res, next) => {
  try {
    const hasBuildingStructure = db.get('SELECT id FROM building_unit_type WHERE unit_type_id=:id LIMIT 1', {
      id: req.params.id
    });
    const hasSales = db.get('SELECT id FROM unit_type_sale_record WHERE unit_type_id=:id LIMIT 1', {
      id: req.params.id
    });

    if (hasBuildingStructure || hasSales) {
      db.update('unit_type', { status: 'inactive', updated_at: db.now() }, { id: req.params.id });
      return res.json({ code: 0, message: '户型已有业务数据，已停用' });
    }

    db.remove('unit_type', { id: req.params.id });
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

export default router;
