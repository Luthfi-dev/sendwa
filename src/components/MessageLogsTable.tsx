import React, { useState, useEffect } from 'react';
import { Search, Trash2, Filter, Eye, CheckCircle2, XCircle, Clock, ArrowDownLeft, ArrowUpRight, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { WhatsAppMessageLog } from '../types/whatsapp';

interface MessageLogsTableProps {
  logs: WhatsAppMessageLog[];
  onClearLogs: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const MessageLogsTable: React.FC<MessageLogsTableProps> = ({
  logs,
  onClearLogs,
  onRefresh,
  isLoading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Sukses' | 'Gagal'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Broadcast' | 'Incoming' | 'Outgoing'>('All');
  const [selectedLog, setSelectedLog] = useState<WhatsAppMessageLog | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset pagination on search/filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  const getDaysUntilAutoDelete = (isoStr: string): number => {
    const createdMs = new Date(isoStr).getTime();
    if (isNaN(createdMs)) return 7;
    const expiresMs = createdMs + 7 * 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(7, diffDays));
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.sender_phone.includes(searchTerm) ||
      log.message_body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.reply_body && log.reply_body.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || log.status === statusFilter;

    const isBroadcastLog =
      log.sender_name.toLowerCase().includes('broadcast') ||
      (log.reply_body && log.reply_body.toLowerCase().includes('broadcast'));

    const matchesType =
      typeFilter === 'All' ||
      (typeFilter === 'Broadcast' && isBroadcastLog) ||
      (typeFilter === 'Incoming' && log.direction === 'incoming') ||
      (typeFilter === 'Outgoing' && log.direction === 'outgoing');

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = filteredLogs.slice((validCurrentPage - 1) * pageSize, validCurrentPage * pageSize);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  return (
    <div id="message-logs-container" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden mb-8 transition-colors duration-200">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Riwayat Pesan, Broadcast &amp; Log Webhook
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Auto-Hapus 7 Hari Aktif
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Menampilkan log pesan masuk, balasan otomatis, dan pengiriman broadcast. Seluruh log otomatis dihapus setelah 7 hari.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            id="clear-logs-btn"
            onClick={() => setShowConfirmClear(true)}
            disabled={logs.length === 0}
            className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 rounded-xl transition-colors flex items-center space-x-1.5 disabled:opacity-40 min-h-[38px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Log</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="search-message-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, nomor WA, atau pesan..."
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400"
          />
        </div>

        {/* Status & Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-1.5 mr-1">
            {(
              [
                { id: 'All', label: 'Semua Log' },
                { id: 'Broadcast', label: 'Log Broadcast' },
                { id: 'Incoming', label: 'Pesan Masuk' },
                { id: 'Outgoing', label: 'Pesan Keluar' }
              ] as const
            ).map(tp => (
              <button
                key={tp.id}
                onClick={() => setTypeFilter(tp.id)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  typeFilter === tp.id
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {tp.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1 font-semibold">
            <Filter className="w-3 h-3" /> Status:
          </span>

          {(['All', 'Sukses', 'Gagal'] as const).map((st) => (
            <button
              key={st}
              id={`filter-status-${st.toLowerCase()}`}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              {st === 'All' ? 'Semua' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Native Card View */}
      <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">
            <div className="flex justify-center items-center space-x-2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Memuat data pesan...</span>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500 dark:text-slate-400">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Tidak ada riwayat pesan ditemukan.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gunakan simulator untuk mencoba pesan masuk pertama Anda.</p>
          </div>
        ) : (
          paginatedLogs.map((log) => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="p-4 space-y-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                    {log.sender_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white block leading-tight">
                      {log.sender_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block -mt-0.5">
                      +{log.sender_phone}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatDate(log.created_at)}</span>
                  </span>
                  {log.status === 'Sukses' ? (
                    <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-600" /> Sukses
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                      <XCircle className="w-2.5 h-2.5 mr-1 text-rose-600" /> Gagal
                    </span>
                  )}
                </div>
              </div>

              {/* Message preview snippet */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-2.5">
                <div className="flex items-start space-x-2 text-slate-800 dark:text-slate-200">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="line-clamp-2 text-[11px] font-medium leading-relaxed break-words">{log.message_body}</p>
                </div>

                {log.reply_body && (
                  <div className="flex items-start space-x-2 text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="line-clamp-2 italic text-[11px] leading-relaxed break-words">{log.reply_body}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Auto-hapus: {getDaysUntilAutoDelete(log.created_at)} hari lagi
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLog(log);
                    }}
                    className="w-full sm:w-auto justify-center px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-xl text-[11px] font-black flex items-center space-x-1.5 border border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Detail Log 👁️</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Messages Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase font-bold border-b border-slate-200 dark:border-slate-800 tracking-wider">
            <tr>
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-4">Pengirim</th>
              <th className="py-3 px-4">Nomor WA</th>
              <th className="py-3 px-4">Pesan Masuk</th>
              <th className="py-3 px-4">Balasan Bot</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  <div className="flex justify-center items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Memuat data pesan...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Tidak ada riwayat pesan ditemukan.</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gunakan simulator untuk mencoba pesan masuk pertama Anda.</p>
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                  {/* Waktu */}
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-sans font-semibold mt-0.5">
                        Auto-hapus: {getDaysUntilAutoDelete(log.created_at)} hari lagi
                      </span>
                    </div>
                  </td>

                  {/* Nama Pengirim */}
                  <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center font-bold text-[11px]">
                        {log.sender_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[120px]">{log.sender_name}</span>
                    </div>
                  </td>

                  {/* Nomor WA */}
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    +{log.sender_phone}
                  </td>

                  {/* Isi Pesan Masuk */}
                  <td className="py-3 px-4 max-w-xs">
                    <div className="flex items-start space-x-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="truncate text-slate-900 dark:text-slate-100 font-medium">{log.message_body}</p>
                    </div>
                  </td>

                  {/* Balasan Bot */}
                  <td className="py-3 px-4 max-w-xs">
                    {log.reply_body ? (
                      <div className="flex items-start space-x-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <p className="truncate text-slate-600 dark:text-slate-400 italic">{log.reply_body}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Status Balasan */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {log.status === 'Sukses' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" /> Sukses
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20" title={log.error_detail}>
                        <XCircle className="w-3 h-3 mr-1 text-rose-600 dark:text-rose-400" /> Gagal
                      </span>
                    )}
                  </td>

                  {/* Detail Action */}
                  <td className="py-3 px-4 text-right">
                    <button
                      id={`view-log-detail-${log.id}`}
                      onClick={() => setSelectedLog(log)}
                      className="px-2.5 py-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 rounded-xl font-extrabold text-[11px] transition-colors border border-emerald-200 dark:border-emerald-500/30 flex items-center space-x-1.5 ml-auto"
                      title="Lihat Detail Pesan Log"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Log 👁️</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Count & Pagination Controls */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Menampilkan {filteredLogs.length === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1} - {Math.min(validCurrentPage * pageSize, filteredLogs.length)} dari total {filteredLogs.length} pesan
          </span>
        </div>

        {/* Pagination Buttons */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-xl font-black text-xs transition-all ${
                  validCurrentPage === page
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* MODAL DETAIL PESAN */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-900 dark:text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span>Detail Log Pesan Webhook</span>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ×
              </button>
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">ID Log</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 truncate block">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Meta WAM ID</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 truncate block">{selectedLog.wam_id || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Nama Pengirim</span>
                  <span className="font-semibold text-slate-900 dark:text-white truncate block">{selectedLog.sender_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Nomor WhatsApp</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold block">+{selectedLog.sender_phone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 dark:text-slate-400 block">Waktu Penerimaan</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">{formatDate(selectedLog.created_at)}</span>
                </div>
              </div>

              {/* Message Body */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Isi Pesan Masuk:</label>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {selectedLog.message_body}
                </div>
              </div>

              {/* Reply Body */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Balasan Otomatis Bot:</label>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 font-mono whitespace-pre-wrap break-words leading-relaxed font-semibold">
                  {selectedLog.reply_body || '(Tidak ada balasan)'}
                </div>
              </div>

              {/* Error Detail if Failed */}
              {selectedLog.error_detail && (
                <div>
                  <label className="text-rose-600 dark:text-rose-400 font-bold block mb-1">Detail Kendala / Error:</label>
                  <div className="bg-rose-50 dark:bg-rose-500/10 p-3 rounded-xl border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 font-mono text-[11px] break-words">
                    {selectedLog.error_detail}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-right pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR LOGS MODAL */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Konfirmasi Hapus Riwayat Log</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Apakah Anda yakin ingin menghapus seluruh riwayat log pesan? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end space-x-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onClearLogs();
                  setShowConfirmClear(false);
                }}
                className="px-4 py-2 bg-rose-600 text-white hover:bg-rose-500 text-xs font-bold rounded-xl shadow-xs"
              >
                Ya, Hapus Semua Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
