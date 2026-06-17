import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={S.container}>
          <Text style={S.icon}>⚠️</Text>
          <Text style={S.title}>Something went wrong</Text>
          <Text style={S.message}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity style={S.btn} onPress={this.handleRetry}>
            <Text style={S.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const S = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, backgroundColor: '#F8FAFC',
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A',
    marginBottom: 8, textAlign: 'center',
  },
  message: {
    fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#64748B',
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  btn: {
    backgroundColor: '#0C1559', paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 24,
  },
  btnText: { color: '#FFF', fontSize: 14, fontFamily: 'Montserrat-Bold' },
});
