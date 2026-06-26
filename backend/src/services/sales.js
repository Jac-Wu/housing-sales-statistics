import db from '../db/index.js';

export function toInt(value, fallback = 0) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

export function ratio(sold, total) {
  const safeTotal = toInt(total);
  if (safeTotal <= 0) return 0;
  return Number(((toInt(sold) / safeTotal) * 100).toFixed(2));
}

export async function updateProjectTotalUnits(projectId) {
  if (!projectId) return;
  const result = db.get('SELECT COALESCE(SUM(total_units), 0) as total FROM building WHERE project_id=:project_id', {
    project_id: projectId
  });
  db.update('project', { total_units: toInt(result?.total), updated_at: db.now() }, { id: projectId });
}

export async function recalculateBuildingFrom(buildingId) {
  const building = db.get('SELECT * FROM building WHERE id=:id', { id: buildingId });
  if (!building) return;

  const records = db.all(
    'SELECT * FROM daily_sign_record WHERE building_id=:building_id ORDER BY sign_date ASC, id ASC',
    { building_id: buildingId }
  );

  let previousAvailable = null;

  for (const record of records) {
    const availableUnits = toInt(record.available_units);
    const adjustmentUnits = toInt(record.adjustment_units);
    const derivedSold = previousAvailable === null
      ? 0
      : previousAvailable + adjustmentUnits - availableUnits;
    const cumulativeSold = Math.max(toInt(building.total_units) - availableUnits, 0);

    db.update('daily_sign_record', {
      derived_sold_units: derivedSold,
      cumulative_sold_units: cumulativeSold,
      updated_at: db.now()
    }, { id: record.id });

    previousAvailable = availableUnits;
  }

  const latest = db.get(
    'SELECT * FROM daily_sign_record WHERE building_id=:building_id ORDER BY sign_date DESC, id DESC LIMIT 1',
    { building_id: buildingId }
  );

  const soldUnits = latest ? toInt(latest.cumulative_sold_units) : toInt(building.sold_units);
  const availableUnits = latest ? toInt(latest.available_units) : Math.max(toInt(building.total_units) - soldUnits, 0);

  db.update('building', {
    sold_units: soldUnits,
    unsold_units: availableUnits,
    updated_at: db.now()
  }, { id: buildingId });

  await updateProjectTotalUnits(building.project_id);
}

export async function validateSignSnapshot({ building_id, sign_date, available_units, adjustment_units = 0, id = null }) {
  const building = db.get('SELECT * FROM building WHERE id=:id', { id: building_id });
  const errors = [];

  if (!building) {
    errors.push({ field: 'building_id', message: '楼栋不存在' });
    return { valid: false, errors };
  }

  const available = toInt(available_units, Number.NaN);
  const adjustment = toInt(adjustment_units);

  if (!Number.isFinite(available)) {
    errors.push({ field: 'available_units', message: '可售套数必须为整数' });
  } else {
    if (available < 0) errors.push({ field: 'available_units', message: '可售套数不能小于 0' });
    if (available > toInt(building.total_units)) {
      errors.push({ field: 'available_units', message: '可售套数不能大于楼栋总房源' });
    }
  }

  if (!sign_date) errors.push({ field: 'sign_date', message: '网签日期不能为空' });

  const duplicate = id
    ? db.get(
      'SELECT * FROM daily_sign_record WHERE building_id=:building_id AND sign_date=:sign_date AND id<>:id',
      { building_id, sign_date, id }
    )
    : db.get(
      'SELECT * FROM daily_sign_record WHERE building_id=:building_id AND sign_date=:sign_date',
      { building_id, sign_date }
    );
  if (duplicate) {
    errors.push({ field: 'sign_date', message: '同一日期、同一楼栋已存在可售快照' });
  }

  const previous = sign_date
    ? db.get(
      'SELECT * FROM daily_sign_record WHERE building_id=:building_id AND sign_date<:sign_date ORDER BY sign_date DESC, id DESC LIMIT 1',
      { building_id, sign_date }
    )
    : null;

  if (previous && Number.isFinite(available)) {
    const derivedSold = toInt(previous.available_units) + adjustment - available;
    if (derivedSold < 0) {
      errors.push({
        field: 'available_units',
        message: '可售套数较前一有效日期增加，需填写足够的调整套数和调整原因'
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function getSupplementDifferences({ project_id, building_id } = {}) {
  const conditions = ['b.sold_units > 0'];
  const params = {};

  if (project_id) {
    conditions.push('b.project_id = :project_id');
    params.project_id = project_id;
  }
  if (building_id) {
    conditions.push('b.id = :building_id');
    params.building_id = building_id;
  }

  const buildings = db.all(
    `SELECT b.id, b.project_id, b.name as building_name, b.sold_units,
            b.unsold_units as available_units, b.total_units
       FROM building b
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.name ASC`,
    params
  );

  return buildings.map((building) => {
    const unitTypes = db.all(
      `SELECT but.id, but.unit_type_id, but.total_units, but.sold_units, but.unsold_units,
              ut.name as unit_type_name
         FROM building_unit_type but
         JOIN unit_type ut ON but.unit_type_id = ut.id
        WHERE but.building_id = :building_id
        ORDER BY ut.name ASC`,
      { building_id: building.id }
    );

    const supplementedSold = unitTypes.reduce((sum, ut) => sum + toInt(ut.sold_units), 0);
    const derivedSold = toInt(building.sold_units);
    const difference = derivedSold - supplementedSold;
    let status = 'completed';

    if (supplementedSold === 0 && derivedSold > 0) status = 'pending';
    else if (difference > 0) status = 'pending';
    else if (difference < 0) status = 'mismatch';

    return {
      ...building,
      supplemented_sold_units: supplementedSold,
      difference_units: difference,
      status,
      unit_types: unitTypes
    };
  });
}

export async function getBuildingUnitTypes(buildingId) {
  return db.all(
    `SELECT but.id, but.building_id, but.unit_type_id, but.total_units,
            but.sold_units, but.unsold_units, ut.name as unit_type_name
       FROM building_unit_type but
       JOIN unit_type ut ON but.unit_type_id = ut.id
      WHERE but.building_id=:building_id
      ORDER BY ut.name ASC`,
    { building_id: buildingId }
  );
}
