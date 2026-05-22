import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Z_INDEX } from '../constants/zIndex';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6" style={{ zIndex: Z_INDEX.DROPDOWN }}>
                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-2xl w-full border border-gray-700">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
                        <p className="text-gray-300 mb-4">
                            An unexpected error occurred in the application.
                        </p>

                        {this.state.error && (
                            <div className="bg-gray-900 p-4 rounded overflow-auto max-h-48 mb-6 border border-gray-700 font-mono text-sm text-red-300">
                                <p className="font-bold mb-2">{this.state.error.toString()}</p>
                                {this.state.errorInfo && (
                                    <pre className="whitespace-pre-wrap text-xs text-gray-500">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors"
                            >
                                Reload Application
                            </button>
                            {/* Optional: Add a button to copy error or save logs */}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
