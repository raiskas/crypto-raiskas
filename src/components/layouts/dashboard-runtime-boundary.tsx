"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

export class DashboardRuntimeBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "Erro inesperado no dashboard.",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[DashboardRuntimeBoundary] erro capturado:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-lg border bg-background p-6 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">Falha ao carregar esta tela</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Houve um erro no runtime do dashboard. Recarregue a página para tentar de novo.
          </p>
          {process.env.NODE_ENV !== "production" && this.state.errorMessage && (
            <pre className="mt-4 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.errorMessage}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
