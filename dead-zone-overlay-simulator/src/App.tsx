import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone, Play, Square, Lock, Unlock, Shield, ShieldAlert,
  Settings, Code, Copy, Check, RotateCcw, Info, ExternalLink,
  Move, Maximize2, FileText, ChevronRight, CheckCircle, AlertOctagon, HelpCircle
} from 'lucide-react';
import { ANDROID_PROJECT_CODE, CodeFile } from './androidCode';

export default function App() {
  // Simulator State
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [serviceActive, setServiceActive] = useState<boolean>(false);
  const [deadZoneLocked, setDeadZoneLocked] = useState<boolean>(false);
  
  // Dimensions and coordinates inside the simulated 340x580 phone screen
  const [boxX, setBoxX] = useState<number>(30);
  const [boxY, setBoxY] = useState<number>(100);
  const [boxW, setBoxW] = useState<number>(200);
  const [boxH, setBoxH] = useState<number>(180);

  // Dragging / Resizing states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });

  // Emergency Button state (coordinates and trailing indicators)
  const [emergencyX, setEmergencyX] = useState<number>(270);
  const [emergencyY, setEmergencyY] = useState<number>(60);
  const [isDraggingEmergency, setIsDraggingEmergency] = useState<boolean>(false);
  const [emergencyDragOffset, setEmergencyDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Interactive Phone Background Activity log & Interactive Elements
  const [blockedTouchesLog, setBlockedTouchesLog] = useState<Array<{ id: number; x: number; y: number; time: string }>>([]);
  const [allowedClicksMsg, setAllowedClicksMsg] = useState<string>("Tapped: Ready");
  const [canvasDrawing, setCanvasDrawing] = useState<boolean>(false);
  const [canvasLines, setCanvasLines] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [currentLine, setCurrentLine] = useState<Array<{ x: number; y: number }>>([]);
  const [interactionMode, setInteractionMode] = useState<'draw' | 'click'>('draw');
  const [userClicksCounter, setUserClicksCounter] = useState<number>(0);

  // App Code Viewer / Guide state
  const [selectedFileTab, setSelectedFileTab] = useState<number>(0);
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);

  // Press & Hold stopwatch states
  const [volHoldTime, setVolHoldTime] = useState<number>(0);
  const [isPressingVol, setIsPressingVol] = useState<boolean>(false);

  // Refs for Javascript timers
  const volHoldIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (volHoldIntervalRef.current) clearInterval(volHoldIntervalRef.current);
    };
  }, []);

  const startVolKeysHold = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!serviceActive) return;
    
    setIsPressingVol(true);
    setVolHoldTime(0);
    
    if (volHoldIntervalRef.current) clearInterval(volHoldIntervalRef.current);
    
    const startTime = Date.now();
    volHoldIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= 10000) {
        setServiceActive(false);
        setDeadZoneLocked(false);
        setVolHoldTime(0);
        setIsPressingVol(false);
        setAllowedClicksMsg("✅ Daemon Stopped Safely (10s Volume Keys Hold Completed)!");
        if (volHoldIntervalRef.current) {
          clearInterval(volHoldIntervalRef.current);
          volHoldIntervalRef.current = null;
        }
      } else {
        setVolHoldTime(elapsed);
      }
    }, 100);
  };

  const endVolKeysHold = () => {
    if (volHoldIntervalRef.current) {
      clearInterval(volHoldIntervalRef.current);
      volHoldIntervalRef.current = null;
    }
    if (isPressingVol) {
      if (volHoldTime < 10000) {
        setAllowedClicksMsg("⚠️ Prevented accidental stop! Keep Volume buttons held for 10 seconds!");
      }
      setIsPressingVol(false);
      setVolHoldTime(0);
    }
  };

  // Refs
  const simulatedScreenRef = useRef<HTMLDivElement>(null);

  // Auto-Lock helper notice
  const [showNotificationPopup, setShowNotificationPopup] = useState<boolean>(false);

  useEffect(() => {
    if (serviceActive) {
      setShowNotificationPopup(true);
      const timer = setTimeout(() => {
        setShowNotificationPopup(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowNotificationPopup(false);
    }
  }, [serviceActive]);

  // Handle Drag/Resize movements bound inside Phone Canvas
  const handlePhoneMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!simulatedScreenRef.current) return;
    
    // Abstract coordinates relative to phone screen top-left
    const rect = simulatedScreenRef.current.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    if (isDragging && !deadZoneLocked) {
      // Keep boundaries inside phone screen (340 x 580)
      const targetX = Math.max(0, Math.min(320 - boxW, currentX - dragOffset.x));
      const targetY = Math.max(0, Math.min(560 - boxH, currentY - dragOffset.y));
      setBoxX(targetX);
      setBoxY(targetY);
    } else if (isResizing && !deadZoneLocked) {
      const deltaX = currentX - resizeStart.x;
      const deltaY = currentY - resizeStart.y;
      const targetW = Math.max(80, Math.min(320 - boxX, resizeStart.w + deltaX));
      const targetH = Math.max(60, Math.min(560 - boxY, resizeStart.h + deltaY));
      setBoxW(targetW);
      setBoxH(targetH);
    } else if (isDraggingEmergency) {
      const targetX = Math.max(0, Math.min(320 - 44, currentX - emergencyDragOffset.x));
      const targetY = Math.max(0, Math.min(560 - 44, currentY - emergencyDragOffset.y));
      setEmergencyX(targetX);
      setEmergencyY(targetY);
    } else if (canvasDrawing && interactionMode === 'draw') {
      // Test if current cursor point falls inside the locked dead zone!
      const isInsideDeadZone =
        serviceActive &&
        deadZoneLocked &&
        currentX >= boxX &&
        currentX <= boxX + boxW &&
        currentY >= boxY &&
        currentY <= boxY + boxH;

      if (isInsideDeadZone) {
        // Drop current line segment to simulate interrupted touches, and record incident
        if (currentLine.length > 0) {
          setCanvasLines(prev => [...prev, currentLine]);
          setCurrentLine([]);
        }
        triggerBlockedTouch(currentX, currentY);
      } else {
        // Allow point
        setCurrentLine(prev => [...prev, { x: currentX, y: currentY }]);
      }
    }
  };

  const handlePhoneMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsDraggingEmergency(false);
    
    if (canvasDrawing && interactionMode === 'draw') {
      setCanvasDrawing(false);
      if (currentLine.length > 0) {
        setCanvasLines(prev => [...prev, currentLine]);
        setCurrentLine([]);
      }
    }
  };

  const handlePhoneMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode === 'draw' && serviceActive && deadZoneLocked) {
      if (!simulatedScreenRef.current) return;
      const rect = simulatedScreenRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const isInsideDeadZone =
        currentX >= boxX &&
        currentX <= boxX + boxW &&
        currentY >= boxY &&
        currentY <= boxY + boxH;

      if (isInsideDeadZone) {
        triggerBlockedTouch(currentX, currentY);
        return; // Block drawing initialization
      }
    }
    
    if (interactionMode === 'draw') {
      setCanvasDrawing(true);
    }
  };

  // Log a blocked touch event
  const triggerBlockedTouch = (x: number, y: number) => {
    const freshId = Date.now();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setBlockedTouchesLog(prev => [
      { id: freshId, x: Math.round(x), y: Math.round(y), time: timestamp },
      ...prev.slice(0, 14)
    ]);
  };

  // Custom interaction click for Background button simulator
  const handleAppButtonClick = (e: React.MouseEvent, type: string) => {
    e.stopPropagation(); // Avoid triggering background drawings
    
    if (!simulatedScreenRef.current) return;
    const rect = simulatedScreenRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Is inside the active dead zone and zone is locked?
    if (serviceActive && deadZoneLocked && clickX >= boxX && clickX <= boxX + boxW && clickY >= boxY && clickY <= boxY + boxH) {
      triggerBlockedTouch(clickX, clickY);
      return;
    }

    // Success outside interaction
    if (type === 'increment') {
      setUserClicksCounter(v => v + 1);
      setAllowedClicksMsg(`Tap Registered! Count: ${userClicksCounter + 1}`);
    } else if (type === 'reset') {
      setCanvasLines([]);
      setUserClicksCounter(0);
      setAllowedClicksMsg("Cleared Simulation!");
    }
  };

  const executeCopyCode = (index: number, codeStr: string) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedFileIndex(index);
    setTimeout(() => {
      setCopiedFileIndex(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Premium Elegant Navigation Banner */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-lg shadow-inner ring-1 ring-white/10">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Dead Zone Overlay <span className="text-xs bg-blue-500/20 text-blue-400 font-medium px-2 py-0.5 rounded-full border border-blue-500/30">Kotlin App + Web Sandbox</span>
              </h1>
              <p className="text-xs text-slate-400">Configure, move, and lock screen blocking sectors. Touch mitigation engine.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Environment Preview
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ================= COLUMN 1: INTERACTIVE SANDBOX GRAPHIC (4 Cols) ================= */}
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col items-center">
          
          <div className="sticky top-24 w-full flex flex-col items-center">
            {/* Header description */}
            <div className="w-full mb-4 text-center lg:text-left">
              <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400">Smartphone Sandbox</h2>
              <p className="text-xs text-slate-400 mt-1">Simulate touch blockades live before compiling compiled Kotlin apps.</p>
            </div>

            {/* Simulated Android Hardware Frame */}
            <div className="relative bg-slate-950 ring-4 ring-slate-800 rounded-[38px] p-4 shadow-2xl border border-slate-700 max-w-[350px] w-full">
              {/* Simulated Hardware Volume Buttons on the Left Frame Edge */}
              <div 
                onMouseDown={startVolKeysHold}
                onTouchStart={startVolKeysHold}
                onMouseUp={endVolKeysHold}
                onMouseLeave={endVolKeysHold}
                onTouchEnd={endVolKeysHold}
                className={`absolute top-28 -left-1.5 w-2.5 h-12 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white select-none transition-all rounded-l-md cursor-pointer flex items-center justify-center text-[7px] font-semibold ${
                  serviceActive ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "opacity-65"
                }`}
                title="Simulated Volume Up button (Hold to Stop)"
              >
                <span className="transform -rotate-90 origin-center text-[5.5px]">VOL+</span>
              </div>
              <div 
                onMouseDown={startVolKeysHold}
                onTouchStart={startVolKeysHold}
                onMouseUp={endVolKeysHold}
                onMouseLeave={endVolKeysHold}
                onTouchEnd={endVolKeysHold}
                className={`absolute top-44 -left-1.5 w-2.5 h-12 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white select-none transition-all rounded-l-md cursor-pointer flex items-center justify-center text-[7px] font-semibold ${
                  serviceActive ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "opacity-65"
                }`}
                title="Simulated Volume Down button (Hold to Stop)"
              >
                <span className="transform -rotate-90 origin-center text-[5.5px]">VOL-</span>
              </div>
              {/* Top Speaker Slot */}
              <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 z-30">
                <div className="w-10 h-1 bg-slate-850 rounded-full"></div>
              </div>

              {/* Status Indicator / Frame Permissions Flag */}
              <div className="absolute top-12 left-6 z-20 flex gap-1 items-center">
                {!permissionGranted && (
                  <div className="bg-red-500/95 text-[10px] text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md font-sans">
                    <ShieldAlert className="w-3 h-3" /> Drawer Permission Required
                  </div>
                )}
                {permissionGranted && serviceActive && (
                  <div className="bg-emerald-500/95 text-[10px] text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md font-sans font-medium">
                    <CheckCircle className="w-3 h-3" /> FGS Active
                  </div>
                )}
              </div>

              {/* Notification Dialog simulated overlay */}
              {showNotificationPopup && (
                <div className="absolute top-20 left-6 right-6 z-40 bg-slate-900/95 border border-slate-700 rounded-xl p-2.5 shadow-lg animate-bounce text-xs">
                  <div className="flex gap-2 items-start">
                    <div className="bg-blue-600 rounded p-1 text-slate-100 text-[9px] font-bold">FGS</div>
                    <div className="flex-1 text-[11px]">
                      <p className="font-bold text-white text-xs">Overlay Controller</p>
                      <p className="text-slate-300">Click &apos;Lock Zone&apos; inside the box below to activate live touch blocking.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Simulated Screen Glass Viewport */}
              <div
                ref={simulatedScreenRef}
                onMouseMove={handlePhoneMouseMove}
                onTouchMove={handlePhoneMouseMove}
                onMouseUp={handlePhoneMouseUp}
                onTouchEnd={handlePhoneMouseUp}
                onMouseDown={handlePhoneMouseDown}
                className="relative w-[320px] h-[560px] bg-slate-900 rounded-[24px] overflow-hidden select-none select-none border border-slate-800 shadow-inner"
                style={{ touchAction: 'none' }}
              >
                
                {/* 1. Android Top Status Bar */}
                <div className="w-full absolute top-0 left-0 h-7 bg-slate-950/80 backdrop-blur-xs flex items-center justify-between px-4 text-[10px] text-slate-400 font-mono z-30 pointer-events-none">
                  <span>10:42 AM</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] bg-slate-800 text-slate-300 px-1 rounded">5G</span>
                    <div className="w-4 h-2 border border-slate-400 rounded-xs relative flex items-center p-px">
                      <div className="bg-emerald-400 h-full w-[80%]"></div>
                    </div>
                  </div>
                </div>

                {/* 2. Phone Application Content Layer */}
                <div className="w-full h-full pt-7 pb-4 flex flex-col justify-between px-3 bg-slate-920">
                  
                  {/* Internal Panel: Mock App dashboard controls */}
                  <div className="pt-2 flex flex-col gap-2.5 z-10">
                    
                    {/* Simulator App Header */}
                    <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                      <div className="bg-blue-500/20 text-blue-400 p-1 rounded-sm">
                        <Smartphone className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-extrabold text-white leading-none">TOUCH BLOCKER v1.0</h4>
                        <p className="text-[8px] text-slate-400">Settings dashboard</p>
                      </div>
                    </div>

                    {/* Permission Module Toggle inside layout */}
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Shield className={`w-3.5 h-3.5 ${permissionGranted ? "text-emerald-400" : "text-amber-400"}`} />
                          <span className="text-[10px] font-semibold text-slate-200">Overlay Drawing Perm</span>
                        </div>
                        <button
                          onClick={() => setPermissionGranted(p => !p)}
                          className={`text-[8px] font-bold px-2 py-0.5 rounded transition-all ${
                            permissionGranted 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/25 cursor-pointer hover:bg-amber-500/20"
                          }`}
                        >
                          {permissionGranted ? "GRANTED" : "GRANT NOW"}
                        </button>
                      </div>
                      <p className="text-[8px] text-slate-400 mt-1">Allows drawing dead zone boundaries over background screens.</p>
                    </div>

                    {/* Service Engine Switch */}
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-200">Foreground Daemon</span>
                        <div className="flex items-center gap-1.5">
                          {!serviceActive ? (
                            <button
                              disabled={!permissionGranted}
                              onClick={() => {
                                if (permissionGranted) {
                                  setServiceActive(true);
                                  setAllowedClicksMsg("Tapped: Service Started");
                                }
                              }}
                              className={`px-2.5 py-1 rounded text-[9px] font-extrabold flex items-center justify-center gap-1 transition-all ${
                                !permissionGranted 
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                              }`}
                            >
                              <Play className="w-2 h-2" /> START
                            </button>
                          ) : (
                            <button
                              onMouseDown={startVolKeysHold}
                              onTouchStart={startVolKeysHold}
                              onMouseUp={endVolKeysHold}
                              onMouseLeave={endVolKeysHold}
                              onTouchEnd={endVolKeysHold}
                              className="px-2 py-1 rounded text-[8px] font-extrabold flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 relative overflow-hidden min-w-[124px]"
                            >
                              {isPressingVol && (
                                <div 
                                  className="absolute inset-y-0 left-0 bg-amber-700/60 pointer-events-none transition-all duration-100"
                                  style={{ width: `${(volHoldTime / 10000) * 100}%` }}
                                />
                              )}
                              <span className="relative z-10">
                                {isPressingVol ? `STOPPING (${Math.round((volHoldTime / 10000) * 100)}%)` : "HOLD VOL TO STOP"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[8px] text-slate-400 mt-1">
                        {serviceActive 
                          ? "🔒 Service locked. Hold simulated volume keys on device left side to shut down." 
                          : "Starts foreground touch blockage daemon. Spawns secure movable sector."}
                      </p>
                    </div>

                    {/* Interactive controls and drawings selectors */}
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 flex items-center justify-between gap-1">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400">Visual Test Tool</span>
                        <span className="text-[10px] font-medium text-slate-100">{interactionMode === 'draw' ? "✏️ Scribble Canvas" : "☝️ Direct Clicker"}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setInteractionMode('draw')}
                          className={`text-[8px] px-2 py-1 rounded ${interactionMode === 'draw' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
                        >
                          Draw
                        </button>
                        <button
                          onClick={() => setInteractionMode('click')}
                          className={`text-[8px] px-2 py-1 rounded ${interactionMode === 'click' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
                        >
                          Click
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* 3. The Live Sandbox Interactive Test Background */}
                  <div className="flex-1 my-2 bg-slate-950/60 rounded-xl relative overflow-hidden border border-slate-800 flex flex-col justify-between p-2">
                    
                    {/* SVG Drawing Canvas component */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-80">
                      {canvasLines.map((line, idx) => (
                        <path
                          key={idx}
                          d={line.length > 0 ? `M ${line[0].x} ${line[0].y} ` + line.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') : ''}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                      {currentLine.length > 0 && (
                        <path
                          d={`M ${currentLine[0].x} ${currentLine[0].y} ` + currentLine.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>

                    {/* Top Guide Text */}
                    <div className="pointer-events-none z-5 text-center p-1 bg-slate-900/60 backdrop-blur-xs rounded border border-slate-850">
                      <p className="text-[9px] text-slate-200 font-semibold uppercase">Drawing Canvas Background</p>
                      <p className="text-[8px] text-slate-400 italic">Drag mouse or finger here to draw lines.</p>
                    </div>

                    {/* Center background buttons to click and test blocker */}
                    <div className="flex flex-col gap-2 items-center my-auto z-10">
                      <div className="bg-slate-900/95 border border-slate-800 p-2 rounded-lg text-center shadow-lg w-full max-w-[220px]">
                        <p className="text-[9px] font-bold text-indigo-400">Mock App Controls</p>
                        <p className="text-[10px] text-slate-200 mt-0.5">{allowedClicksMsg}</p>
                        
                        <div className="flex gap-1 justify-center mt-2">
                          <button
                            onClick={(e) => handleAppButtonClick(e, "increment")}
                            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-650 transition text-white text-[8px] font-bold px-2.5 py-1 rounded-md border border-slate-750"
                          >
                            + Tap Me
                          </button>
                          <button
                            onClick={(e) => handleAppButtonClick(e, "reset")}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[8px] px-2 py-1 rounded-md border border-slate-750"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Custom Sandbox Indicators */}
                    <div className="pointer-events-none text-[8px] font-mono text-slate-500 text-center flex justify-between z-10 px-1">
                      <span>X: {Math.round(boxX)} Y: {Math.round(boxY)}</span>
                      <span>W: {Math.round(boxW)} H: {Math.round(boxH)}</span>
                    </div>

                  </div>

                  {/* 4. Android Bottom Navigation Keys */}
                  <div className="h-4 flex justify-around items-center text-slate-500 pointer-events-none">
                    <div className="w-3.5 h-3.5 border border-slate-600 rounded-sm"></div>
                    <div className="w-3.5 h-3.5 border border-slate-600 rounded-full"></div>
                    <span className="text-xs">&lt;</span>
                  </div>

                </div>

                {/* ================= SIMULATED OVERLAY ACTIVE BOX ================= */}
                {permissionGranted && serviceActive && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${boxX}px`,
                      top: `${boxY}px`,
                      width: `${boxW}px`,
                      height: `${boxH}px`,
                      zIndex: 35,
                    }}
                    className={`rounded transition-colors flex flex-col justify-between ${
                      deadZoneLocked
                        ? "border-2 border-dashed border-red-500 bg-red-500/15 cursor-not-allowed text-red-400 shadow-md"
                        : "border-2 border-dashed border-blue-500 bg-blue-500/25 text-blue-300"
                    }`}
                  >
                    
                    {/* Header info bar / Dragger */}
                    <div
                      onMouseDown={(e) => {
                        if (deadZoneLocked) return;
                        e.stopPropagation();
                        setIsDragging(true);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setDragOffset({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top
                        });
                      }}
                      className={`text-[9px] font-bold p-1 flex justify-between items-center ${
                        deadZoneLocked ? 'bg-red-500/20' : 'bg-blue-500/30 cursor-move'
                      }`}
                    >
                      <span className="flex items-center gap-1 tracking-wider">
                        {deadZoneLocked ? <Lock className="w-2.5 h-2.5 text-red-400" /> : <Move className="w-2.5 h-2.5 text-blue-300 animate-pulse" />}
                        {deadZoneLocked ? "TOUCH BLOCKED" : "DRAG & REPOSITION"}
                      </span>
                      
                      {!deadZoneLocked && (
                        <span className="text-[7px] bg-blue-600 text-white px-1 rounded uppercase font-mono">Edit</span>
                      )}
                    </div>

                    {/* Central Area Label */}
                    <div className="flex-1 flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                      <p className="text-[9px] font-extrabold uppercase tracking-widest leading-tight">
                        {deadZoneLocked ? "Touches Blocked" : "Dead Zone Config"}
                      </p>
                      <p className="text-[7px] opacity-75 mt-0.5 max-w-[90%] mx-auto">
                        {deadZoneLocked 
                          ? "Any touch events occurring inside this rectangular segment are fully absorbed." 
                          : "Position block bounds anywhere overlaying bottom or side touch inputs."}
                      </p>
                    </div>

                    {/* Footer Lock Toggle / Size Details */}
                    <div className="p-1.5 flex items-center justify-between pointer-events-auto bg-slate-950/80 backdrop-blur-xs text-[9px] border-t border-slate-800">
                      
                      {/* Interactive Lock Zone Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeadZoneLocked(!deadZoneLocked);
                        }}
                        className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-bold text-[8px] border transition ${
                          deadZoneLocked
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-sm"
                        }`}
                      >
                        {deadZoneLocked ? (
                          <>
                            <Unlock className="w-2.5 h-2.5" /> Unlock Box
                          </>
                        ) : (
                          <>
                            <Lock className="w-2.5 h-2.5" /> Lock & Block
                          </>
                        )}
                      </button>

                      <span className="font-mono text-[7px] text-slate-400">
                        {Math.round(boxW)} x {Math.round(boxH)}
                      </span>
                    </div>

                    {/* Resizing Handle at bottom right (Omitted in locked state) */}
                    {!deadZoneLocked && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIsResizing(true);
                          if (simulatedScreenRef.current) {
                            const rect = simulatedScreenRef.current.getBoundingClientRect();
                            setResizeStart({
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top,
                              w: boxW,
                              h: boxH
                            });
                          }
                        }}
                        className="absolute bottom-[-1px] right-[-1px] w-[22px] h-[22px] bg-blue-500 cursor-se-resize rounded-tl-sm flex items-end justify-end p-0.5 shadow-md active:bg-blue-600"
                      >
                        <Maximize2 className="w-2.5 h-2.5 text-white transform rotate-45" />
                      </div>
                    )}

                  </div>
                )}



              </div>
            </div>

            {/* Sandbox Logs Visualizer */}
            <div className="w-full mt-4 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-1.5">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                  Touch mitigation event logs
                </h4>
                <button
                  onClick={() => setBlockedTouchesLog([])}
                  className="text-[9px] text-slate-500 hover:text-slate-300 transition-colors uppercase"
                >
                  Clear logs
                </button>
              </div>

              <div className="h-32 overflow-y-auto font-mono text-[9px] text-slate-400 bg-slate-910 p-2 rounded-lg border border-slate-850 space-y-1">
                {blockedTouchesLog.length === 0 ? (
                  <p className="text-slate-600 italic text-center py-8">No blocked touches logged. Enable the overlay service, lock the dead zone block, and try drawing or clicking inside it inside the simulation wrapper.</p>
                ) : (
                  blockedTouchesLog.map((log) => (
                    <div key={log.id} className="flex justify-between items-center text-red-400 bg-red-950/30 font-medium border-l-2 border-red-500 py-1 px-1.5 rounded-sm animate-fade-in">
                      <span>🚫 Swallowed accidental touch</span>
                      <span>X:{log.x} Y:{log.y}</span>
                      <span className="text-[8px] text-slate-500">{log.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </section>

        {/* ================= COLUMN 2: CODE COMPANION CONTROLLER & STATS (8 Cols) ================= */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          
          {/* Main Visual Instructions Card */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 relative overflow-hidden shadow-xl">
            <div className="absolute right-0 top-0 w-64 h-64 bg-blue-600/5 rounded-full filter blur-3xl pointer-events-none"></div>

            <div className="max-w-2xl">
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Kotlin Touch Block Zone Implementation Guide
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Avoid annoying virtual buttons, hardware defects, or accidental hand touches when reading or playing apps. This suite provides the complete source logic to stand up a movable system-wide touchscreen block zone.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-850 flex items-start gap-3">
                  <div className="bg-blue-500/10 text-blue-400 p-2 rounded-lg font-bold">1</div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">System overlay flags</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Uses <code className="text-[10px] bg-slate-950 px-1 py-0.5 rounded text-blue-300">TYPE_APPLICATION_OVERLAY</code> combined with <code className="text-[10px] bg-slate-950 px-1 py-0.5 rounded text-blue-300">FLAG_NOT_FOCUSABLE</code> and custom bounds sizing to absorb touches.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-850 flex items-start gap-3">
                  <div className="bg-blue-500/10 text-blue-400 p-2 rounded-lg font-bold">2</div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">Gesture Interception Math</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Tracks initial touch offsets on <code className="text-[10px] bg-slate-950 px-1 py-0.5 rounded text-blue-300">ACTION_DOWN</code> events and re-measures bounding box dimensions on <code className="text-[10px] bg-slate-950 px-1 py-0.5 rounded text-blue-300">ACTION_MOVE</code> dynamically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabbed Code Explorer & File Structure */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col">
            
            {/* Folder Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex gap-2 items-center">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-white">Kotlin Project Codebase Drawer</h3>
                  <p className="text-[11px] text-slate-400 font-mono">/android-project/ - Fully functional folder structure</p>
                </div>
              </div>

              {/* Stats detail */}
              <div className="text-[11px] font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                Project Target: <span className="text-indigo-400 font-bold">Android 14 (API 34) + Jetpack Compose</span>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-slate-850 bg-slate-940 overflow-x-auto scrollbar-thin">
              {ANDROID_PROJECT_CODE.map((file, idx) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileTab(idx)}
                  className={`px-5 py-3.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 ${
                    selectedFileTab === idx
                      ? "border-blue-500 bg-slate-910 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-920"
                  }`}
                >
                  <Code className="w-3.5 h-3.5 opacity-70" />
                  {file.name}
                </button>
              ))}
            </div>

            {/* CODE PREVIEW LAYER */}
            <div className="p-6 bg-slate-910 flex flex-col gap-4">
              
              {/* File details */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-xs font-mono text-slate-500 tracking-tight">
                    PATH: <span className="text-slate-300 font-bold">{ANDROID_PROJECT_CODE[selectedFileTab].path}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                    {ANDROID_PROJECT_CODE[selectedFileTab].description}
                  </p>
                </div>

                {/* COPY BUTTON */}
                <button
                  onClick={() => executeCopyCode(selectedFileTab, ANDROID_PROJECT_CODE[selectedFileTab].code)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition duration-200 ${
                    copiedFileIndex === selectedFileTab
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {copiedFileIndex === selectedFileTab ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      COPIED!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      COPY CODE
                    </>
                  )}
                </button>
              </div>

              {/* Code viewer editor window */}
              <div className="relative rounded-2xl bg-slate-950 border border-slate-850 overflow-hidden group">
                {/* Code panel heading identifier */}
                <div className="flex items-center justify-between bg-slate-920 px-4 py-2 border-b border-slate-850 text-[10px] font-mono text-slate-400">
                  <span>File type: {ANDROID_PROJECT_CODE[selectedFileTab].language.toUpperCase()}</span>
                  <span>UTF-8 compliant</span>
                </div>

                <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-300 bg-slate-950 max-h-[460px] scrollbar-thin">
                  <code>{ANDROID_PROJECT_CODE[selectedFileTab].code}</code>
                </pre>
              </div>

            </div>

          </div>

          {/* STEP BY STEP INSTALLATION GUIDE */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-4 uppercase tracking-wider">
              <ChevronRight className="w-4 h-4 text-indigo-400" />
              How to compile in Android Studio
            </h3>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-[10px] font-extrabold flex items-center justify-center text-indigo-400 border border-slate-700">1</span>
                <div>
                  <p className="font-bold text-white">Create a New Android Project</p>
                  <p className="text-slate-400 mt-0.5">Open Android Studio and choose <span className="text-slate-200 font-mono">Empty Activity (with Jetpack Compose support)</span>. Name your package scope as <span className="font-mono bg-slate-900 text-indigo-300 px-1 py-0.5 rounded text-[10px]">com.deadzone.overlay</span>.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-[10px] font-extrabold flex items-center justify-center text-indigo-400 border border-slate-700">2</span>
                <div>
                  <p className="font-bold text-white">Paste Kotlin Sources</p>
                  <p className="text-slate-400 mt-0.5">Replace your MainActivity.kt file and create a new OverlayService.kt file using the code snippets from the explorer above. Confirm directories match <span className="font-mono text-slate-200">com/deadzone/overlay/</span>.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-[10px] font-extrabold flex items-center justify-center text-indigo-400 border border-slate-700">3</span>
                <div>
                  <p className="font-bold text-white">Update Manifest & Gradle</p>
                  <p className="text-slate-400 mt-0.5">Copy and paste the <span className="text-slate-200 font-mono">AndroidManifest.xml</span> and <span className="text-slate-200 font-mono">app/build.gradle.kts</span>. Sync the Gradle files with Android Studio to fetch Jetpack Compose and Core components.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-[10px] font-extrabold flex items-center justify-center text-indigo-400 border border-slate-700">4</span>
                <div>
                  <p className="font-bold text-white">Run & Test Accidental Touch Protection</p>
                  <p className="text-slate-400 mt-0.5">Deploy the app to your real physical telephone unit or dynamic emulator device, approve the on-screen Draw Over Overlay Permission, tap start, and enjoy a completely custom dead zone protector.</p>
                </div>
              </div>
            </div>
          </div>

        </section>

      </main>

      <footer className="border-t border-slate-850 mt-16 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <p>Dead Zone Overlay Studio Tool • Designed for modern accessibility setups, palm rejection helpers, and touchscreen protections.</p>
      </footer>
    </div>
  );
}
