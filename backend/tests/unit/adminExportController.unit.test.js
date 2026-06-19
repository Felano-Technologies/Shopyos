'use strict';

/**
 * tests/unit/adminExportController.unit.test.js
 *
 * Unit tests for exportResource in backend/controllers/adminExportController.js.
 *
 * The controller:
 *   1. Validates the :resource param against a known config map.
 *   2. Queries the DB via getPool().query(sql, params).
 *   3. Streams output as CSV (fast-csv) or XLSX (ExcelJS).
 *
 * All DB, ExcelJS, and fast-csv calls are mocked.
 */

// ── postgres pool mock ────────────────────────────────────────────────────────
const mockPool = { query: jest.fn() };
jest.mock('../../config/postgres', () => ({
  getPool: jest.fn(() => mockPool),
}));

// ── ExcelJS mock ──────────────────────────────────────────────────────────────
// The controller does: new ExcelJS.Workbook(), wb.addWorksheet(), ws.columns=,
// ws.addRow(), ws.getRow(1).font=, ws.getRow(1).fill=, await wb.xlsx.write(res)
const mockWorksheet = {
  columns: null,
  addRow:  jest.fn(),
  getRow:  jest.fn(() => ({ font: null, fill: null })),
};

const mockXlsx = { write: jest.fn() };

const MockWorkbook = jest.fn().mockImplementation(() => ({
  addWorksheet: jest.fn(() => mockWorksheet),
  xlsx:         mockXlsx,
}));

jest.mock('exceljs', () => ({ Workbook: MockWorkbook }));

// ── fast-csv mock ─────────────────────────────────────────────────────────────
// The controller does: const stream = csvFormat({ headers }); stream.pipe(res);
// stream.write(out); stream.end();
const mockCsvStream = {
  pipe:  jest.fn(),
  write: jest.fn(),
  end:   jest.fn(),
};

jest.mock('fast-csv', () => ({
  format: jest.fn(() => mockCsvStream),
}));

// ── pull in module under test after mocks are in place ───────────────────────
const { exportResource } = require('../../controllers/adminExportController');
const fastCsv            = require('fast-csv');

// ── helpers ───────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params:  {},
    query:   {},
    body:    {},
    user:    { id: 'admin-1' },
    headers: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    setHeader: jest.fn(),
    end:       jest.fn(),
    status:    jest.fn(),
    json:      jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('adminExportController – exportResource unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // XLSX write resolves immediately by default
    mockXlsx.write.mockResolvedValue(undefined);
    // DB returns empty rows by default
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  // ── unknown resource → 400 ──────────────────────────────────────────────────
  test('test_exportResource_unknownResource_returns400', async () => {
    // Arrange
    const req  = mockReq({ params: { resource: 'unknown' }, query: {} });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Unknown export resource') })
    );
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // ── XLSX: correct Content-Type header ──────────────────────────────────────
  test('test_exportResource_xlsxFormat_setsCorrectContentTypeHeader', async () => {
    // Arrange
    const userRow = { Name: 'Alice', Email: 'alice@test.com', Phone: null, Role: 'buyer', Status: 'Active', Joined: new Date('2024-01-01') };
    mockPool.query.mockResolvedValueOnce({ rows: [userRow] });

    const req = mockReq({
      params: { resource: 'users' },
      query:  { format: 'xlsx' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(mockXlsx.write).toHaveBeenCalledWith(res);
    expect(next).not.toHaveBeenCalled();
  });

  // ── CSV: correct Content-Type header ───────────────────────────────────────
  test('test_exportResource_csvFormat_setsTextCsvContentType', async () => {
    // Arrange
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { resource: 'users' },
      query:  { format: 'csv' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(fastCsv.format).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.any(Array) })
    );
    expect(mockCsvStream.pipe).toHaveBeenCalledWith(res);
    expect(next).not.toHaveBeenCalled();
  });

  // ── DB error → next(error) ──────────────────────────────────────────────────
  test('test_exportResource_dbQueryThrows_callsNext', async () => {
    // Arrange
    const dbError = new Error('DB connection lost');
    mockPool.query.mockRejectedValueOnce(dbError);

    const req = mockReq({
      params: { resource: 'users' },
      query:  { format: 'xlsx' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  // ── users resource: SQL contains FROM users ─────────────────────────────────
  test('test_exportResource_usersResource_executesCorrectSQL', async () => {
    // Arrange
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { resource: 'users' },
      query:  { format: 'xlsx' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/FROM users/i);
  });

  // ── XLSX: rows are added to worksheet ──────────────────────────────────────
  test('test_exportResource_xlsxFormat_addsRowsToWorksheet', async () => {
    // Arrange
    const rows = [
      { Name: 'Alice', Email: 'alice@test.com', Phone: '0241', Role: 'buyer', Status: 'Active', Joined: null },
      { Name: 'Bob',   Email: 'bob@test.com',   Phone: null,   Role: 'seller', Status: 'Inactive', Joined: null },
    ];
    mockPool.query.mockResolvedValueOnce({ rows });

    const req = mockReq({
      params: { resource: 'users' },
      query:  { format: 'xlsx' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    expect(mockWorksheet.addRow).toHaveBeenCalledTimes(2);
    expect(res.end).toHaveBeenCalled();
  });

  // ── CSV: rows are written to stream ────────────────────────────────────────
  test('test_exportResource_csvFormat_writesRowsToStream', async () => {
    // Arrange
    const rows = [
      { Name: 'Alice', Email: 'alice@test.com', Phone: '', Role: 'buyer', Status: 'Active', Joined: '' },
    ];
    mockPool.query.mockResolvedValueOnce({ rows });

    const req = mockReq({
      params: { resource: 'users' },
      query:  { format: 'csv' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    expect(mockCsvStream.write).toHaveBeenCalledTimes(1);
    expect(mockCsvStream.end).toHaveBeenCalled();
  });

  // ── orders resource: SQL contains FROM orders ───────────────────────────────
  test('test_exportResource_ordersResource_executesCorrectSQL', async () => {
    // Arrange
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { resource: 'orders' },
      query:  { format: 'xlsx' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/FROM orders/i);
  });

  // ── format defaults to xlsx when not specified ──────────────────────────────
  test('test_exportResource_noFormatParam_defaultsToXlsx', async () => {
    // Arrange
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { resource: 'users' },
      query:  {}, // no format key
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  // ── Content-Disposition header includes the resource name ──────────────────
  test('test_exportResource_xlsxFormat_setsContentDispositionWithResourceName', async () => {
    // Arrange
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { resource: 'stores' },
      query:  { format: 'xlsx' },
    });
    const res  = mockRes();
    const next = jest.fn();

    // Act
    await exportResource(req, res, next);

    // Assert
    const dispositionCall = res.setHeader.mock.calls.find(
      ([header]) => header === 'Content-Disposition'
    );
    expect(dispositionCall).toBeDefined();
    expect(dispositionCall[1]).toMatch(/stores/);
    expect(dispositionCall[1]).toMatch(/\.xlsx/);
  });
});
