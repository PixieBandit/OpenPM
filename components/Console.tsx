
import React, { useRef, useEffect, useState } from 'react';
import { LogEntry, AetherAPI, TaskStatus, TaskPriority } from '../types';
import { acousticEngine } from '../services/audio';

interface ConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  api?: AetherAPI;
  onLog?: (source: LogEntry['source'], message: string, type: LogEntry['type']) => void;
}

const Console: React.FC<ConsoleProps> = ({ logs, onClear, api, onLog }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [command, setCommand] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !api || !onLog) return;

    const cmd = command.trim();
    onLog('USER', `> ${cmd}`, 'COMMAND');
    setCommand('');
    acousticEngine.playTick();

    // Mock simple command parser
    const parts = cmd.split(' ');
    const action = parts[0].toLowerCase();

    try {
      if (action === '/help') {
        onLog('SYSTEM', 'Available commands: /task, /doc, /bios, /sync, /clear', 'INFO');
      } 
      else if (action === '/sync') {
        api.system.sync();
        onLog('SYSTEM', 'Initiating manual neural sync...', 'INFO');
      }
      else if (action === '/clear') {
        onClear();
      }
      else if (action === '/task' && parts[1] === 'create') {
        const title = parts.slice(2).join(' ') || 'Manual Directive';
        api.tasks.create({ title, priority: TaskPriority.MEDIUM });
      }
      else if (action === '/task' && parts[1] === 'list') {
        const tasks = api.tasks.list();
        onLog('SYSTEM', `Retrieved ${tasks.length} directives. Check Directive Board.`, 'SUCCESS');
      }
      else if (action === '/bios' && parts[1] === 'power') {
        const pwr = parseInt(parts[2]);
        if (!isNaN(pwr)) {
          api.system.setConfig({ novaPower: pwr });
          onLog('SYSTEM', `Nova power recalibrated to ${pwr}%`, 'SUCCESS');
        }
      }
      else {
        onLog('SYSTEM', `Unknown command: ${action}. Type /help for assistance.`, 'ERROR');
        acousticEngine.playError();
      }
    } catch (err) {
      onLog('SYSTEM', 'Syntax error in command stream.', 'ERROR');
      acousticEngine.playError();
    }
  };

  return (
    <div className="h-48 bg-black/90 border-t border-slate-800 flex flex-col font-mono relative overflow-hidden transition-all focus-within:h-64 group">
      {/* CRT Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-900 bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
             <div className="w-2 h-2 rounded-full bg-rose-500/50" />
             <div className="w-2 h-2 rounded-full bg-amber-500/50" />
             <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AetherSync_Neural_Terminal v4.5</span>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-[9px] text-slate-700 animate-pulse">NeuralLink_Stable</span>
           <button onClick={onClear} className="text-[9px] text-slate-600 hover:text-white transition-colors">[PURGE_LOGS]</button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 text-[11px] selection:bg-indigo-500/50 custom-scrollbar">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-4 group">
            <span className="text-slate-700 shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
            <span className={`shrink-0 font-bold w-12 text-center ${
              log.source === 'NOVA' ? 'text-indigo-400' : 
              log.source === 'SPARK' ? 'text-teal-400' : 
              log.source === 'USER' ? 'text-amber-400' : 'text-slate-500'
            }`}>{log.source}</span>
            <span className={`flex-1 ${
              log.type === 'ERROR' ? 'text-rose-400' : 
              log.type === 'WARN' ? 'text-amber-400' : 
              log.type === 'SUCCESS' ? 'text-emerald-400' : 
              log.type === 'COMMAND' ? 'text-indigo-400 italic' : 'text-slate-300'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-800 italic">SYSTEM_IDLE: Awaiting data stream...</div>
        )}
      </div>

      <form onSubmit={handleCommand} className="px-4 py-2 bg-slate-950 border-t border-slate-900 flex items-center gap-3 shrink-0">
         <span className="text-indigo-500 font-bold text-[11px] tracking-tighter">nu-node07:~$</span>
         <input 
           ref={inputRef}
           type="text" 
           value={command}
           onChange={(e) => setCommand(e.target.value)}
           placeholder="Type /help to see commands..."
           className="bg-transparent border-none focus:ring-0 text-[11px] text-slate-300 flex-1 p-0 font-mono caret-indigo-500"
         />
      </form>
    </div>
  );
};

export default Console;
