import { useEffect, useState, useMemo } from 'react';
import { assetRequestsAPI, assetsAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import {
  Laptop, Monitor, Keyboard, Mouse, Printer,
  Plus, Search, RefreshCw, CheckCircle, XCircle,
  Clock, AlertTriangle, UserCheck, Shield, Sparkles,
  Inbox, Tag, Check, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ASSET_TYPES = ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Printer'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function getTypeIcon(type) {
  switch (type?.toLowerCase()) {
    case 'laptop': return <Laptop size={16} />;
    case 'monitor': return <Monitor size={16} />;
    case 'keyboard': return <Keyboard size={16} />;
    case 'mouse': return <Mouse size={16} />;
    case 'printer': return <Printer size={16} />;
    default: return <Laptop size={16} />;
  }
}

// Modal for regular users (Employee / Support) to request an asset
function RequestAssetModal({ onClose, onDone }) {
  const [form, setForm] = useState({
    asset_type: 'Laptop',
    preferred_specs: '',
    reason: '',
    priority: 'MEDIUM',
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) {
      return toast.error('Please specify the reason/business purpose for this request');
    }
    setLoading(true);
    try {
      await assetRequestsAPI.create(form);
      toast.success('Asset request submitted to Administrator!');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to submit asset request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Request IT Asset"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Request to Admin'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Asset Type <span className="req">*</span></label>
          <select
            className="form-control"
            value={form.asset_type}
            onChange={e => set('asset_type', e.target.value)}
          >
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="form-hint">Select the category of hardware you require.</div>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">User Reference & Preferred Specifications</label>
          <textarea
            className="form-control"
            rows={2}
            value={form.preferred_specs}
            onChange={e => set('preferred_specs', e.target.value)}
            placeholder="e.g. Dell Latitude / MacBook Pro, 16GB RAM, 512GB SSD, or 27-inch 4K Monitor..."
          />
          <div className="form-hint">Specify preferred brand, hardware specifications, or reference details for the admin.</div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-control"
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Business Purpose & Need <span className="req">*</span></label>
          <textarea
            className="form-control"
            rows={3}
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            placeholder="Describe why you need this asset (e.g. new project onboarding, replacement of faulty device, extra screen for software development)..."
            required
            minLength={5}
          />
        </div>
      </form>
    </Modal>
  );
}

// Modal for Admin to assign an inventory asset to fulfill a request
function AdminAssignModal({ request, onClose, onDone }) {
  const [availableAssets, setAvailableAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(request.asset_type || 'ALL');

  useEffect(() => {
    const fetchInventory = async () => {
      setLoadingAssets(true);
      try {
        const res = await assetRequestsAPI.availableInventory();
        setAvailableAssets(res.data || []);
      } catch (err) {
        toast.error('Failed to load available inventory');
      } finally {
        setLoadingAssets(false);
      }
    };
    fetchInventory();
  }, []);

  const filteredInventory = useMemo(() => {
    let list = availableAssets;
    if (typeFilter !== 'ALL') {
      list = list.filter(a => a.asset_type?.toLowerCase() === typeFilter.toLowerCase());
    }
    const q = assetSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(a =>
        a.asset_tag?.toLowerCase().includes(q) ||
        a.brand?.toLowerCase().includes(q) ||
        a.model?.toLowerCase().includes(q) ||
        a.serial_number?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [availableAssets, typeFilter, assetSearch]);

  const handleAssign = async () => {
    if (!selectedAssetId) {
      return toast.error('Please select an available inventory asset to assign');
    }
    setSubmitting(true);
    try {
      await assetRequestsAPI.assign(request.id, {
        asset_id: selectedAssetId,
        admin_notes: adminNotes.trim() || undefined,
      });
      toast.success(`Asset successfully assigned to ${request.user?.name || 'user'}!`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to assign asset');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAsset = availableAssets.find(a => a.id === selectedAssetId);

  return (
    <Modal
      title={`Assign Asset for Request: ${request.request_number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAssign}
            disabled={submitting || !selectedAssetId}
          >
            {submitting ? 'Assigning...' : 'Confirm & Assign Asset'}
          </button>
        </>
      }
    >
      {/* Requester & Reference Summary */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--glass-border)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requester</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {request.user?.name} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>({request.user?.department || 'General'})</span>
            </div>
          </div>
          <span className="badge badge-pending">PENDING REQUEST</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Requested Type:</span>{' '}
            <strong style={{ color: 'var(--accent)' }}>{request.asset_type}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Priority:</span>{' '}
            <PriorityBadge priority={request.priority} />
          </div>
          {request.preferred_specs && (
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>User Reference / Specs:</span>{' '}
              <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{request.preferred_specs}"</span>
            </div>
          )}
          <div style={{ gridColumn: 'span 2' }}>
            <span style={{ color: 'var(--text-muted)' }}>Purpose:</span>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{request.reason}</span>
          </div>
        </div>
      </div>

      {/* Inventory Selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>
            Select Available Asset from Inventory <span className="req">*</span>
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${typeFilter === request.asset_type ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTypeFilter(request.asset_type)}
            >
              Only {request.asset_type}s
            </button>
            <button
              type="button"
              className={`btn btn-sm ${typeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTypeFilter('ALL')}
            >
              All Available
            </button>
          </div>
        </div>

        <input
          className="form-control"
          placeholder="Filter by asset tag, brand, model, or serial #..."
          value={assetSearch}
          onChange={e => setAssetSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <div style={{
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid var(--glass-border)',
          borderRadius: 8,
          background: 'var(--bg-card)'
        }}>
          {loadingAssets ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading available inventory...
            </div>
          ) : filteredInventory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              No available assets match your filter.
            </div>
          ) : (
            filteredInventory.map(asset => {
              const isSelected = selectedAssetId === asset.id;
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--glass-border)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                    borderColor: isSelected ? 'var(--accent)' : undefined,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32,
                      borderRadius: 8,
                      background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {getTypeIcon(asset.asset_type)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginRight: 6 }}>{asset.asset_tag}</span>
                        {asset.brand} {asset.model}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        SN: {asset.serial_number} • {asset.asset_type}
                      </div>
                    </div>
                  </div>
                  <div>
                    {isSelected ? (
                      <span className="badge badge-resolved" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12} /> Selected
                      </span>
                    ) : (
                      <span className="badge badge-available">Available</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedAsset && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--success)'
        }}>
          Selected for assignment: <strong>{selectedAsset.asset_tag}</strong> ({selectedAsset.brand} {selectedAsset.model})
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Admin Remarks / Allocation Notes</label>
        <textarea
          className="form-control"
          rows={2}
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="e.g. Approved and allocated based on user specifications..."
        />
      </div>
    </Modal>
  );
}

// Modal for Admin to reject a request
function AdminRejectModal({ request, onClose, onDone }) {
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    setLoading(true);
    try {
      await assetRequestsAPI.reject(request.id, {
        admin_notes: adminNotes.trim() || 'Request rejected by administrator'
      });
      toast.success('Asset request rejected');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Reject Request: ${request.request_number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={handleReject} disabled={loading}>
            {loading ? 'Rejecting...' : 'Confirm Rejection'}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
        Are you sure you want to reject the <strong>{request.asset_type}</strong> request submitted by <strong>{request.user?.name}</strong>?
      </div>
      <div className="form-group">
        <label className="form-label">Reason for Rejection</label>
        <textarea
          className="form-control"
          rows={3}
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="e.g. Currently out of stock, or user already has an active laptop..."
        />
      </div>
    </Modal>
  );
}

export default function AssetRequestsPage() {
  const { user, isAdmin } = useAuth();
  const { connected, lastEvent } = useWebSocket();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modal controls
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [assigningRequest, setAssigningRequest] = useState(null);
  const [rejectingRequest, setRejectingRequest] = useState(null);

  const fetchRequests = async () => {
    try {
      const res = await assetRequestsAPI.list();
      setRequests(res.data || []);
    } catch (err) {
      toast.error('Failed to load asset requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // React to live WebSocket events
  useEffect(() => {
    if (lastEvent?.event?.startsWith('ASSET_REQUEST_')) {
      fetchRequests();
    }
  }, [lastEvent]);

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this pending request?')) return;
    try {
      await assetRequestsAPI.cancel(requestId);
      toast.success('Request cancelled');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel request');
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && r.asset_type?.toLowerCase() !== typeFilter.toLowerCase()) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        r.request_number?.toLowerCase().includes(q) ||
        r.asset_type?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q) ||
        r.preferred_specs?.toLowerCase().includes(q) ||
        r.user?.name?.toLowerCase().includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        r.user?.department?.toLowerCase().includes(q) ||
        r.assigned_asset?.asset_tag?.toLowerCase().includes(q)
      );
    });
  }, [requests, statusFilter, typeFilter, search]);

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const assignedCount = requests.filter(r => r.status === 'ASSIGNED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  return (
    <>
      <Header
        title={isAdmin ? "Asset Requests Management" : "Request IT Asset"}
        subtitle={isAdmin ? "Review employee requests and assign inventory assets" : "Submit hardware requests and track assigned assets"}
        wsConnected={connected}
      />

      <div className="page-content">
        {/* Stats Summary Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon amber">
              <Clock size={20} />
            </div>
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-label">Pending Requests</div>
            {pendingCount > 0 && (
              <div className="stat-delta positive" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="badge-pulse-dot" style={{ width: 7, height: 7 }} /> Awaiting fulfillment
              </div>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-icon emerald">
              <CheckCircle size={20} />
            </div>
            <div className="stat-value">{assignedCount}</div>
            <div className="stat-label">Fulfilled & Assigned</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon sky">
              <Laptop size={20} />
            </div>
            <div className="stat-value">{requests.length}</div>
            <div className="stat-label">Total Requests</div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flex: 1, flexWrap: 'wrap' }}>
            <div className="search-box" style={{ maxWidth: 320 }}>
              <Search size={16} />
              <input
                placeholder={isAdmin ? "Search by requester, tag, or request #..." : "Search your requests..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
              {['ALL', 'PENDING', 'ASSIGNED', 'REJECTED'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'ALL' ? 'All Status' : s}
                </button>
              ))}
            </div>

            {/* Asset Type Dropdown */}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Asset Types</option>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={fetchRequests}
              title="Refresh requests"
            >
              <RefreshCw size={16} />
            </button>

            {/* Non-admin users get the + Request Asset button */}
            {!isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowRequestModal(true)}
              >
                <Plus size={16} /> Request Asset
              </button>
            )}
          </div>
        </div>

        {/* Requests Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                {isAdmin ? 'Incoming Asset Requests' : 'My Asset Requests'}
              </div>
              <div className="card-subtitle">
                {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} found
              </div>
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="loading">
                <div className="spinner" />
                <span>Loading requests...</span>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="empty-state">
                <Inbox size={36} />
                <h3>No asset requests found</h3>
                <p>
                  {!isAdmin
                    ? "You haven't submitted any asset requests yet. Click '+ Request Asset' to request hardware from admin."
                    : 'There are currently no asset requests matching your filters.'}
                </p>
                {!isAdmin && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowRequestModal(true)}
                    style={{ marginTop: 8 }}
                  >
                    <Plus size={16} /> Request an Asset
                  </button>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Request #</th>
                      {isAdmin && <th>Requester</th>}
                      <th>Asset Type</th>
                      <th>User Reference / Specs</th>
                      <th>Purpose & Need</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned Asset</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map(req => {
                      const isPending = req.status === 'PENDING';
                      const isAssigned = req.status === 'ASSIGNED';
                      return (
                        <tr key={req.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>
                            {req.request_number}
                          </td>

                          {isAdmin && (
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.user?.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {req.user?.department || 'General'} • {req.user?.email}
                              </div>
                            </td>
                          )}

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                              <span style={{ color: 'var(--accent)' }}>{getTypeIcon(req.asset_type)}</span>
                              {req.asset_type}
                            </div>
                          </td>

                          <td style={{ maxWidth: 220 }}>
                            {req.preferred_specs ? (
                              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                                {req.preferred_specs}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Standard</span>
                            )}
                          </td>

                          <td style={{ maxWidth: 240, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <div className="truncate" title={req.reason}>{req.reason}</div>
                          </td>

                          <td>
                            <PriorityBadge priority={req.priority} />
                          </td>

                          <td>
                            <StatusBadge status={req.status} />
                          </td>

                          {/* Assigned Asset Details */}
                          <td>
                            {isAssigned && req.assigned_asset ? (
                              <div style={{
                                padding: '4px 8px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                borderRadius: 6,
                                display: 'inline-block'
                              }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--success)' }}>
                                  {req.assigned_asset.asset_tag}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {req.assigned_asset.brand} {req.assigned_asset.model}
                                </div>
                              </div>
                            ) : req.status === 'REJECTED' ? (
                              <span style={{ fontSize: 11, color: 'var(--danger)' }} title={req.admin_notes}>
                                Rejected
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>

                          <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {req.created_at ? format(new Date(req.created_at), 'MMM d, yyyy') : '—'}
                          </td>

                          {/* Action Buttons */}
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isAdmin && isPending && (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => setAssigningRequest(req)}
                                  title="Assign inventory asset to requester"
                                >
                                  <UserCheck size={14} /> Assign Asset
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  onClick={() => setRejectingRequest(req)}
                                  title="Reject request"
                                >
                                  <XCircle size={14} /> Reject
                                </button>
                              </div>
                            )}

                            {!isAdmin && isPending && (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleCancelRequest(req.id)}
                                title="Cancel pending request"
                              >
                                Cancel
                              </button>
                            )}

                            {!isPending && (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Completed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showRequestModal && (
        <RequestAssetModal
          onClose={() => setShowRequestModal(false)}
          onDone={() => {
            setShowRequestModal(false);
            fetchRequests();
          }}
        />
      )}

      {assigningRequest && (
        <AdminAssignModal
          request={assigningRequest}
          onClose={() => setAssigningRequest(null)}
          onDone={() => {
            setAssigningRequest(null);
            fetchRequests();
          }}
        />
      )}

      {rejectingRequest && (
        <AdminRejectModal
          request={rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          onDone={() => {
            setRejectingRequest(null);
            fetchRequests();
          }}
        />
      )}
    </>
  );
}
