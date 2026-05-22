import React, { useState, useEffect, useRef } from 'react';
import { HoverEdgeAutoScroll } from '../../../components/HoverEdgeAutoScroll';
import { useCanvasStore } from '../../../store/canvasStore';
import { BoardImage } from '../../../types';

interface Sam3dPanelProps {
    selectedImage: BoardImage | null;
}

export const Sam3dPanel: React.FC<Sam3dPanelProps> = ({ selectedImage }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
    const [modelLoaded, setModelLoaded] = useState(false);
    const [checkpointPath, setCheckpointPath] = useState('./checkpoints/model.ckpt');
    const [isProcessing, setIsProcessing] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkServer = async () => {
        try {
            const res = await fetch('http://localhost:5000/status');
            const data = await res.json();
            setServerStatus('connected');
            setModelLoaded(data.model_loaded);
            setError(null);
        } catch (e) {
            setServerStatus('disconnected');
            setError('Server not reachable. Please run "python server.py" in sam3d-engine folder.');
        }
    };

    useEffect(() => {
        checkServer();
        const interval = setInterval(checkServer, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLoadModel = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const res = await fetch('http://localhost:5000/load-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkpoint_path: checkpointPath })
            });
            const data = await res.json();
            if (res.ok) {
                setModelLoaded(true);
            } else {
                setError(data.error || 'Failed to load model');
            }
        } catch (e) {
            setError('Network error loading model');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProcess = async () => {
        if (!selectedImage) return;
        setIsProcessing(true);
        setError(null);
        setResultImage(null);

        try {
            // Fetch the image blob from the src
            const imgRes = await fetch(selectedImage.src);
            const blob = await imgRes.blob();

            const formData = new FormData();
            formData.append('image', blob, 'input.png');

            const res = await fetch('http://localhost:5000/process', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setResultImage(data.result_image);
            } else {
                setError(data.error || 'Failed to process image');
            }
        } catch (e) {
            setError('Network error processing image');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="relative flex flex-col h-full">
        <div ref={scrollRef} className="flex flex-col flex-1 p-4 gap-4 text-white overflow-y-auto min-h-0">
            <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                <span className="font-bold">Server Status</span>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${serverStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-neutral-400">{serverStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-sm text-red-200">
                    {error}
                </div>
            )}

            {serverStatus === 'connected' && !modelLoaded && (
                <div className="flex flex-col gap-2 p-4 bg-neutral-800 rounded-lg">
                    <h3 className="font-bold mb-2">Load Model</h3>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-neutral-400">Checkpoint Path</label>
                        <input
                            type="text"
                            value={checkpointPath}
                            onChange={(e) => setCheckpointPath(e.target.value)}
                            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
                        />
                    </div>
                    <button
                        onClick={handleLoadModel}
                        disabled={isProcessing}
                        className="mt-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium disabled:opacity-50"
                    >
                        {isProcessing ? 'Loading...' : 'Load Model'}
                    </button>
                </div>
            )}

            {modelLoaded && (
                <div className="flex flex-col gap-4">
                    <div className="p-4 bg-neutral-800 rounded-lg">
                        <h3 className="font-bold mb-2">Process Image</h3>
                        {!selectedImage ? (
                            <div className="text-neutral-400 text-sm text-center py-4">
                                Select an image on the canvas to process
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="aspect-video bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center">
                                    <img src={selectedImage.src} className="max-w-full max-h-full object-contain" />
                                </div>
                                <button
                                    onClick={handleProcess}
                                    disabled={isProcessing}
                                    className="bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold disabled:opacity-50"
                                >
                                    {isProcessing ? 'Processing...' : 'Run SAM 3D'}
                                </button>
                            </div>
                        )}
                    </div>

                    {resultImage && (
                        <div className="p-4 bg-neutral-800 rounded-lg animate-fade-in">
                            <h3 className="font-bold mb-2">Result</h3>
                            <div className="aspect-video bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center">
                                <img src={resultImage} className="max-w-full max-h-full object-contain" />
                            </div>
                            <button
                                onClick={() => {
                                    // Logic to add result to canvas could go here
                                    // For now just a placeholder or download
                                    const link = document.createElement('a');
                                    link.href = resultImage;
                                    link.download = 'sam3d-result.jpg';
                                    link.click();
                                }}
                                className="mt-3 w-full bg-neutral-700 hover:bg-neutral-600 text-white py-2 rounded-lg text-sm"
                            >
                                Download Result
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
        <HoverEdgeAutoScroll targetRef={scrollRef} />
        </div>
    );
};
