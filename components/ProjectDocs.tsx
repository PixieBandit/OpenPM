
import React, { useState, useEffect, useMemo } from 'react';
import { ProjectDoc, DocVersion } from '../types';
import { acousticEngine } from '../services/audio';

interface ProjectDocsProps {
  docs: ProjectDoc[];
  onAddDoc: (title: string, content: string, category: ProjectDoc['category']) => void;
  onUpdateDoc: (id: string, updates: Partial<ProjectDoc>, commit?: boolean) => void;
  onRevertDoc?: (docId: string, version: DocVersion) => void;
  isSyncing: boolean;
  externalSelectedId?: string | null;
  onSelectDoc?: (id: string | null) => void;
}

const CATEGORIES: ProjectDoc['category'][] = ['ARCH', 'SPEC', 'RESEARCH', 'LOG'];

const ProjectDocs: React.FC<ProjectDocsProps> = ({ 
  docs, onAddDoc, onUpdateDoc, isSyncing, externalSelectedId, onSelectDoc
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(docs[0]?.id || null);
  const [viewMode, setViewMode] = useState<'EDIT' | 'PREVIEW' | 'HISTORY'>('PREVIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | ProjectDoc['category']>('ALL');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const selectedDocId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;

  useEffect(() => {
    if (externalSelectedId) setInternalSelectedId(externalSelectedId);
  }, [externalSelectedId]);

  const handleSelect = (id: string | null) => {
    setInternalSelectedId(id);
    if (onSelectDoc) onSelectDoc(id);
    acousticEngine.playTick();
  };

  const selectedDoc = docs.find(d => d.id === selectedDocId);
  
  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = doc.title.toLowerCase().includes(term) || 
                           doc.content.toLowerCase().includes(term) ||
                           doc.category.toLowerCase().includes(term);
      const matchesCategory = activeFilter === 'ALL' || doc.category === activeFilter;
      return matchesSearch && matchesCategory;
    });
  }, [docs, searchTerm, activeFilter]);

  const parseContent = (content: string) => {
    try { if (content.trim().startsWith('{')) return JSON.parse(content); } catch (e) { }
    return null;
  };

  const renderMarkdown = (content: string) => {
    let html = content
      .replace(/^### (.*$)/gim, '<h3 class="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mt-8 mb-4 flex items-center gap-2"><span class="w-1 h-3 bg-indigo-500 rounded-full"></span>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-black text-white uppercase tracking-tighter mt-10 mb-6 border-b border-slate-800 pb-3">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-teal-400 text-[10px]">$1</code>')
      .replace(/\n\n/g, '<div class="h-4"></div>')
      .replace(/\n/g, '<br />');

    // Simple search highlighting
    if (searchTerm.length > 2) {
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      html = html.replace(regex, '<mark class="bg-indigo-500/30 text-white rounded px-0.5">$1</mark>');
    }

    return <div className="markdown-content text-xs leading-relaxed text-slate-400 font-sans" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const parsed = selectedDoc ? parseContent(selectedDoc.content) : null;

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'ARCH': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'SPEC': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'RESEARCH': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'LOG': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="flex h-[calc(100vh-280px)] bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
      <div className="w-80 border-r border-slate-900 flex flex-col bg-slate-950">
        <div className="p-6 border-b border-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry_Archive</h3>
            </div>
            <div className="relative">
              <button 
                onClick={() => { acousticEngine.playTick(); setShowAddMenu(!showAddMenu); }} 
                className={`p-1.5 rounded-lg border transition-all ${showAddMenu ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-800'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-10 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-800 mb-2 text-center">Select Category</p>
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => {
                        acousticEngine.playTick();
                        onAddDoc(`New ${cat} Documentation`, `### ${cat}_ENTRY\n\n- Define mission requirements\n- Outline technical vector`, cat);
                        setShowAddMenu(false);
                      }}
                      className="w-full text-left p-3 rounded-xl hover:bg-indigo-600/10 text-[10px] font-bold text-slate-400 hover:text-white transition-all uppercase tracking-widest flex items-center justify-between"
                    >
                      {cat}
                      <div className={`w-1.5 h-1.5 rounded-full ${cat === 'ARCH' ? 'bg-purple-500' : cat === 'SPEC' ? 'bg-teal-500' : cat === 'RESEARCH' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by title/cat/data..." 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-700"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1 pb-2 overflow-x-auto custom-scrollbar no-scrollbar">
            <button 
              onClick={() => { acousticEngine.playTick(); setActiveFilter('ALL'); }}
              className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${activeFilter === 'ALL' ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
            >
              ALL_FILES
            </button>
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => { acousticEngine.playTick(); setActiveFilter(cat); }}
                className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${activeFilter === cat ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filteredDocs.map(doc => (
            <button key={doc.id} onClick={() => handleSelect(doc.id)} className={`w-full text-left p-4 rounded-xl transition-all group border-2 relative ${selectedDocId === doc.id ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-transparent border-transparent hover:bg-slate-900/50 hover:border-slate-800'}`}>
              {!doc.isRead && (
                <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.8)]" />
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-tighter ${getCategoryColor(doc.category)}`}>
                  {doc.category}
                </span>
                <div className="w-1 h-1 rounded-full bg-slate-800" />
                <span className={`text-[8px] font-mono ${doc.auditStatus === 'PASSED' ? 'text-emerald-500' : doc.auditStatus === 'FAILED' ? 'text-rose-500' : 'text-slate-700'}`}>
                  {doc.auditStatus === 'PASSED' ? 'VERIFIED' : doc.auditStatus === 'FAILED' ? 'FAULT_DETECTED' : 'PENDING'}
                </span>
              </div>
              <h4 className={`text-[13px] font-bold truncate tracking-tight ${selectedDocId === doc.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                {doc.title}
              </h4>
              <p className="text-[9px] font-mono text-slate-600 mt-1 uppercase">Rev: {doc.lastUpdated}</p>
            </button>
          ))}
          {filteredDocs.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30 grayscale">
              <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest italic">Sector_Zero: Index_Empty</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-950 relative">
        {selectedDoc ? (
          <>
            <div className="px-12 py-8 border-b border-slate-900 flex items-center justify-between backdrop-blur-xl bg-slate-950/80 sticky top-0 z-20">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">{selectedDoc.title}</h2>
                  <div className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${getCategoryColor(selectedDoc.category)}`}>
                    {selectedDoc.category}
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                    OPERATOR: {selectedDoc.author}
                  </span>
                  <span className={`text-[9px] font-black tracking-widest uppercase flex items-center gap-1.5 ${selectedDoc.auditStatus === 'PASSED' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    <div className={`w-1 h-1 rounded-full ${selectedDoc.auditStatus === 'PASSED' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    Audit: {selectedDoc.auditStatus || 'PENDING'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex gap-1 shadow-inner">
                  {['PREVIEW', 'EDIT'].map((mode) => (
                    <button 
                      key={mode} 
                      onClick={() => { setViewMode(mode as any); acousticEngine.playTick(); }} 
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex-1 p-12 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.03),transparent_50%)]">
              {selectedDoc.qaFeedback && (
                <div className={`max-w-4xl mx-auto p-6 rounded-3xl border-2 mb-10 transition-all ${selectedDoc.auditStatus === 'FAILED' ? 'bg-rose-500/10 border-rose-500/20 text-rose-200' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-100'} animate-in slide-in-from-top-4 duration-700 shadow-2xl`}>
                   <div className="flex items-center gap-3 mb-4">
                      <div className={`w-2 h-2 rounded-full ${selectedDoc.auditStatus === 'FAILED' ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`} />
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Quartz Sentinel Diagnostics</h4>
                   </div>
                   <p className="text-[13px] font-mono leading-relaxed opacity-90 italic">"{selectedDoc.qaFeedback}"</p>
                </div>
              )}

              {viewMode === 'EDIT' ? (
                <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-900/40 p-8 rounded-3xl border border-slate-900">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Document Identity</label>
                       <input 
                         type="text" 
                         value={selectedDoc.title}
                         onChange={(e) => onUpdateDoc(selectedDoc.id, { title: e.target.value })}
                         className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 px-6 text-[13px] font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-inner"
                         placeholder="Document Title..."
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Sector Assignment</label>
                       <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {CATEGORIES.map(cat => (
                            <button 
                              key={cat}
                              onClick={() => { acousticEngine.playTick(); onUpdateDoc(selectedDoc.id, { category: cat }); }}
                              className={`py-3 text-[9px] font-black rounded-xl border-2 transition-all uppercase tracking-widest ${selectedDoc.category === cat ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-slate-400'}`}
                            >
                              {cat}
                            </button>
                          ))}
                       </div>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-10 rounded-[2.5rem] border border-slate-900 shadow-2xl relative">
                    <div className="absolute top-8 right-8 text-[9px] font-mono text-slate-800 uppercase tracking-widest pointer-events-none">Buffer_00X_Raw</div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 block ml-1">Registry Buffer (Markdown Supported)</label>
                    <textarea 
                      value={selectedDoc.content} 
                      onChange={(e) => onUpdateDoc(selectedDoc.id, { content: e.target.value })} 
                      className="w-full h-[600px] bg-transparent border-none focus:ring-0 text-slate-300 font-mono text-[13px] leading-relaxed resize-none selection:bg-indigo-500/40" 
                      spellCheck={false} 
                      placeholder="ENTER_DATA_STREAM..." 
                    />
                  </div>
                  <div className="flex justify-end pt-4 pb-20">
                    <button onClick={() => { onUpdateDoc(selectedDoc.id, {}, true); setViewMode('PREVIEW'); acousticEngine.playSuccess(); }} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(99,102,241,0.3)] transition-all flex items-center gap-4 active:scale-95 group">
                      <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Commit Registry Update
                    </button>
                  </div>
                </div>
              ) : parsed ? (
                <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
                  <section className="relative pl-8">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                    <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4">Core Implementation Objective</h3>
                    <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10 shadow-inner">
                      <p className="text-indigo-100 text-[15px] leading-relaxed italic font-serif">"{parsed.purpose}"</p>
                    </div>
                  </section>
                  <section className="relative pl-8">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                    <h3 className="text-[11px] font-black text-teal-400 uppercase tracking-[0.4em] mb-4">Strategic Rationale</h3>
                    <div className="bg-teal-500/5 p-6 rounded-2xl border border-teal-500/10 shadow-inner">
                      <p className="text-slate-300 text-[14px] leading-relaxed">{parsed.rationale}</p>
                    </div>
                  </section>
                  <section className="relative pl-8">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-700 rounded-full" />
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Technical Stack Definitions</h3>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-8 text-teal-500 font-mono text-[13px] leading-relaxed whitespace-pre-wrap shadow-2xl relative overflow-hidden group">
                      <div className="absolute inset-0 bg-indigo-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                      {parsed.implementation_details}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto bg-slate-900/30 p-16 rounded-[3rem] border border-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-700 backdrop-blur-xl mb-20 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
                  {renderMarkdown(selectedDoc.content)}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-6 grayscale opacity-20">
            <svg className="w-20 h-20 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <p className="text-xs font-black uppercase tracking-[0.4em]">Initialize Registry Handshake</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDocs;
