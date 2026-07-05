import React, { useState } from 'react';
import { FileUp, CheckCircle2, Maximize2, Receipt } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ExpenseCapture() {
  const isRtl = document.documentElement.dir === 'rtl';
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const arr = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...arr]);
      simulateProcessing();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const arr = Array.from(e.target.files);
      setFiles(prev => [...prev, ...arr]);
      simulateProcessing();
    }
  };

  const simulateProcessing = () => {
    setProcessing(true);
    setTimeout(() => setProcessing(false), 1500);
  };

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 uppercase">
            Receipt & Bill Capture
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl">
            Upload physical receipts or standard vendor bills. Machine learning routines will automatically extract dates, amounts, and match source documents to clearing transactions.
          </p>
        </div>

        {/* Upload Zone */}
        <div 
          className={cn(
            "relative w-full h-48 md:h-64 rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center transition-all bg-white overflow-hidden cursor-pointer",
            dragActive ? "border-indigo-600 bg-indigo-600/5 scale-[1.01]" : "border-slate-200 hover:border-slate-800/30"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            multiple 
            onChange={handleFileChange} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
            accept="image/*,.pdf"
          />
          <div className="flex flex-col items-center gap-4 pointer-events-none p-6 text-center">
            <div className={cn(
              "w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center transition-transform",
              dragActive ? "scale-110 text-indigo-600" : "text-slate-500"
            )}>
              <FileUp size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Drag & drop files here</h3>
              <p className="text-sm font-medium text-slate-500">Support for PDF, PNG, JPG line extraction</p>
            </div>
          </div>
        </div>

        {/* Processing Queue */}
        {(files.length > 0 || processing) && (
          <div className="space-y-4">
            <h3 className="text-sm text-slate-500 font-bold uppercase tracking-widest">Processing Queue</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processing && (
                <div className="p-4 rounded-[32px] bg-white border border-slate-200 flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                    <Receipt className="text-slate-500 animate-spin" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-50 rounded w-full"></div>
                    <div className="h-3 bg-slate-50 rounded w-2/3"></div>
                  </div>
                </div>
              )}
              
              {!processing && files.map((file, i) => (
                <div key={i} className="p-4 rounded-[32px] bg-white border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all group">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
                    <Receipt className="text-slate-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 truncate">{file.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-500">Extraction Complete</span>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-colors">
                    <Maximize2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
