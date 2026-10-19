import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { assetsAPI, usersAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { StatusBadge } from '../components/Badge';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  Plus, Search, Laptop, Monitor, Keyboard, Mouse, Printer,
  Edit2, Trash2, UserCheck, UserX, RefreshCw, CheckCircle,
  Clock, AlertTriangle, ChevronLeft, ChevronRight, ClipboardList
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ASSET_TYPES = ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Printer'];
const STATUSES = ['AVAILABLE', 'ASSIGNED', 'UNDER_REPAIR', 'RETIRED', 'LOST'];

function getTypeIcon(type) {
  switch (type?.toLowerCase()) {
    case 'laptop': return <Laptop size={15} />;
    case 'monitor': return <Monitor size={15} />;
    case 'keyboard': return <Keyboard size={15} />;
    case 'mouse': return <Mouse size={15} />;
    case 'printer': return <Printer size={15} />;
    default: return <Laptop size={15} />;
  }
}

function AssetForm({ initial = {}, onSave, onClose, loading }) {
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState({
    asset_type: initial.asset_type || 'Laptop',
    brand: initial.brand || '',
    model: initial.model || '',
    serial_number: initial.serial_number || '',
    purchase_date: initial.purchase_date ? initial.purchase_date.split('T')[0] : '',
    status: initial.status || 'AVAILABLE',
    notes: initial.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Asset Type <span className="req">*</span></label>
          <select
            className="form-control"
            value={form.asset_type}
            onChange={e => set('asset_type', e.target.value)}
            disabled={isEdit}
          >
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Brand <span className="req">*</span></label>
          <input
            className="form-control"
            value={form.brand}
            onChange={e => set('brand', e.target.value)}
            placeholder="Dell, HP, Apple, Logitech..."
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Model <span className="req">*</span></label>
          <input
            className="form-control"
            value={form.model}
            onChange={e => set('model', e.target.value)}
            placeholder="Latitude 5440, ThinkPad X1..."
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Serial Number <span className="req">*</span></label>
          <input
            className="form-control"
            value={form.serial_number}
            onChange={e => set('serial_number', e.target.value)}
            placeholder="SN-XXXX-0000"
            required
            disabled={isEdit}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Purchase Date</label>
          <input
            className="form-control"
            type="date"
            value={form.purchase_date}
            onChange={e => set('purchase_date', e.target.value)}
          />
        </div>
        {isEdit && (
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={form.status}
              onChange={e => set('status', e.target.value)}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea
          className="form-control"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Hardware specs, location, or notes..."
          rows={3}
        />
      </div>

      <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update Asset' : 'Save Asset'}
        </button>
      </div>
    </form>
  );
}

function AssignModal({ asset, onClose, onDone }) {
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersAPI.list()
      .then(r => setUsers(r.data.filter(u => u.is_active)))
      .catch(() => toast.error('Failed to load user list'));
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.user_code?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const handleAssign = async () => {
    if (!userId) return toast.error('Please select an employee');
    setLoading(true);
    try {
      await assetsAPI.assign(asset.id, { user_id: parseInt(userId, 10) });
      toast.success(`Asset ${asset.asset_tag} assigned successfully!`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Assign Asset: ${asset.asset_tag}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssign} disabled={loading || !userId}>
            {loading ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
        Assigning <strong>{asset.brand} {asset.model}</strong> ({asset.asset_type})
      </div>

      <div className="form-group">
        <label className="form-label">Search Employee</label>
        <input
          className="form-control"
          placeholder="Filter by name, code, or department..."
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          style={{ marginBottom: 8 }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Select Employee ({filteredUsers.length} available) <span className="req">*</span></label>
        <select
          className="form-control"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          size={6}
          style={{ maxHeight: 180 }}
        >
          {filteredUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.user_code}) — {u.department || 'General'} [{u.role}]
            </option>
          ))}
        </select>
      </div>
    </Modal>
  );
}

export default function AssetsPage() {
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const wsHook = useWebSocket();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [assignAsset, setAssignAsset] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    assetsAPI.list()
      .then(r => setAssets(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Failed to load assets'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter, pageSize]);

  // Status statistics for KPI cards
  const stats = useMemo(() => {
    const total = assets.length;
    const available = assets.filter(a => a.status === 'AVAILABLE').length;
    const assigned = assets.filter(a => a.status === 'ASSIGNED').length;
    const repair = assets.filter(a => a.status === 'UNDER_REPAIR').length;
    const retired = assets.filter(a => a.status === 'RETIRED').length;
    return { total, available, assigned, repair, retired };
  }, [assets]);

  // Filtered dataset
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return assets.filter(a => {
      const matchQ = !q ||
        a.asset_tag?.toLowerCase().includes(q) ||
        a.brand?.toLowerCase().includes(q) ||
        a.model?.toLowerCase().includes(q) ||
        a.serial_number?.toLowerCase().includes(q) ||
        a.assigned_user?.name?.toLowerCase().includes(q) ||
        a.assigned_user?.user_code?.toLowerCase().includes(q);

      const matchS = !statusFilter || a.status === statusFilter;
      const matchT = !typeFilter || a.asset_type === typeFilter;

      return matchQ && matchS && matchT;
    });
  }, [assets, search, statusFilter, typeFilter]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await assetsAPI.create(form);
      toast.success('Asset created successfully!');
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create asset');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form) => {
    setSaving(true);
    try {
      await assetsAPI.update(editAsset.id, form);
      toast.success('Asset updated successfully!');
      setEditAsset(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update asset');
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (asset) => {
    if (!window.confirm(`Are you sure you want to mark ${asset.asset_tag} (${asset.brand} ${asset.model}) as returned?`)) return;
    try {
      await assetsAPI.return(asset.id);
      toast.success(`Asset ${asset.asset_tag} returned to inventory!`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to return asset');
    }
  };

  const handleRetire = async (asset) => {
    if (!window.confirm(`Retire asset ${asset.asset_tag}? This marks it as RETIRED.`)) return;
    try {
      await assetsAPI.delete(asset.id);
      toast.success(`Asset ${asset.asset_tag} retired!`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to retire asset');
    }
  };

  return (
    <>
      <Header title="Assets Management" subtitle="Manage and track company IT inventory" wsConnected={wsHook.connected} />
      <div className="page-content">

        {/* Quick KPI Stats Cards */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div
            className={`stat-card indigo ${statusFilter === '' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('')}
            style={{ cursor: 'pointer' }}
            title="Click to view all assets"
          >
            <div className="stat-icon indigo"><Laptop size={20} /></div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Assets</div>
          </div>

          <div
            className={`stat-card emerald ${statusFilter === 'AVAILABLE' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'AVAILABLE' ? '' : 'AVAILABLE')}
            style={{ cursor: 'pointer' }}
            title="Click to filter Available assets"
          >
            <div className="stat-icon emerald"><CheckCircle size={20} /></div>
            <div className="stat-value">{stats.available}</div>
            <div className="stat-label">Available</div>
          </div>

          <div
            className={`stat-card blue ${statusFilter === 'ASSIGNED' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'ASSIGNED' ? '' : 'ASSIGNED')}
            style={{ cursor: 'pointer' }}
            title="Click to filter Assigned assets"
          >
            <div className="stat-icon blue"><UserCheck size={20} /></div>
            <div className="stat-value">{stats.assigned}</div>
            <div className="stat-label">Assigned</div>
          </div>

          <div
            className={`stat-card amber ${statusFilter === 'UNDER_REPAIR' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'UNDER_REPAIR' ? '' : 'UNDER_REPAIR')}
            style={{ cursor: 'pointer' }}
            title="Click to filter Under Repair assets"
          >
            <div className="stat-icon amber"><Clock size={20} /></div>
            <div className="stat-value">{stats.repair}</div>
            <div className="stat-label">Under Repair</div>
          </div>

          <div
            className={`stat-card rose ${statusFilter === 'RETIRED' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'RETIRED' ? '' : 'RETIRED')}
            style={{ cursor: 'pointer' }}
            title="Click to filter Retired assets"
          >
            <div className="stat-icon rose"><AlertTriangle size={20} /></div>
            <div className="stat-value">{stats.retired}</div>
            <div className="stat-label">Retired</div>
          </div>
        </div>

        {/* Main Asset Table Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Asset Inventory</div>
              <div className="card-subtitle">
                {filtered.length} {filtered.length === 1 ? 'asset' : 'assets'} matching filters (Total {assets.length} in database)
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/asset-requests" className="btn btn-secondary btn-sm" title="Manage User Asset Requests">
                <ClipboardList size={14} /> Asset Requests
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh Assets">
                <RefreshCw size={14} /> Refresh
              </button>
              {isAdmin && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                  <Plus size={14} /> Add Asset
                </button>
              )}
            </div>
          </div>

          <div className="card-body">
            {/* Toolbar: Search & Filters */}
            <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="search-box" style={{ flex: '1 1 240px' }}>
                <Search size={14} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by tag, brand, model, serial, or employee..."
                />
              </div>

              <select
                className="form-control"
                style={{ width: 'auto', minWidth: 140 }}
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                className="form-control"
                style={{ width: 'auto', minWidth: 150 }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                className="form-control"
                style={{ width: 'auto', minWidth: 110 }}
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
              >
                <option value={15}>15 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner" />
                <span>Loading all assets from database...</span>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Asset Tag</th>
                        <th>Type</th>
                        <th>Brand & Model</th>
                        <th>Serial #</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                        <th>Purchase Date</th>
                        {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssets.map(a => (
                        <tr key={a.id}>
                          <td className="td-primary" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {a.asset_tag}
                          </td>
                          <td>
                            <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              {getTypeIcon(a.asset_type)}
                              <span>{a.asset_type}</span>
                            </div>
                          </td>
                          <td className="td-primary">
                            <strong>{a.brand}</strong> {a.model}
                          </td>
                          <td className="text-muted" style={{ fontFamily: 'monospace' }}>
                            {a.serial_number}
                          </td>
                          <td>
                            <StatusBadge status={a.status} />
                          </td>
                          <td>
                            {a.assigned_user ? (
                              <div>
                                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                  {a.assigned_user.name}
                                </span>
                                <span className="text-muted" style={{ marginLeft: 6, fontSize: 11 }}>
                                  ({a.assigned_user.user_code})
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-muted">
                            {a.purchase_date ? format(new Date(a.purchase_date), 'MMM d, yyyy') : '—'}
                          </td>
                          {isAdmin && (
                            <td style={{ textAlign: 'right' }}>
                              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  title="Edit Asset"
                                  onClick={() => setEditAsset(a)}
                                >
                                  <Edit2 size={13} />
                                </button>
                                {a.status === 'AVAILABLE' && (
                                  <button
                                    className="btn btn-sm btn-success"
                                    title="Assign Asset to Employee"
                                    onClick={() => setAssignAsset(a)}
                                  >
                                    <UserCheck size={13} />
                                  </button>
                                )}
                                {a.status === 'ASSIGNED' && (
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    title="Return Asset"
                                    onClick={() => handleReturn(a)}
                                  >
                                    <UserX size={13} />
                                  </button>
                                )}
                                {a.status !== 'RETIRED' && (
                                  <button
                                    className="btn btn-sm btn-danger"
                                    title="Retire Asset"
                                    onClick={() => handleRetire(a)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}

                      {filtered.length === 0 && !loading && (
                        <tr>
                          <td colSpan={isAdmin ? 8 : 7}>
                            <div className="empty-state">
                              <Laptop size={36} style={{ color: 'var(--text-muted)' }} />
                              <h3>No assets found</h3>
                              <p>No assets match your search or filter criteria. Try resetting filters.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filtered.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: '1px solid var(--glass-border)',
                      flexWrap: 'wrap',
                      gap: 12
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> – <strong>{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> assets
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        title="Previous page"
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>

                      <span style={{ fontSize: 13, fontWeight: 600, padding: '0 8px', color: 'var(--text-secondary)' }}>
                        Page {currentPage} of {totalPages}
                      </span>

                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        title="Next page"
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <Modal title="Add New Asset" onClose={() => setShowCreate(false)}>
          <AssetForm onSave={handleCreate} onClose={() => setShowCreate(false)} loading={saving} />
        </Modal>
      )}

      {editAsset && (
        <Modal title={`Edit Asset: ${editAsset.asset_tag}`} onClose={() => setEditAsset(null)}>
          <AssetForm initial={editAsset} onSave={handleUpdate} onClose={() => setEditAsset(null)} loading={saving} />
        </Modal>
      )}

      {assignAsset && (
        <AssignModal
          asset={assignAsset}
          onClose={() => setAssignAsset(null)}
          onDone={() => { setAssignAsset(null); load(); }}
        />
      )}
    </>
  );
}
