/**
 * EL-013 — Main Conversation Screen (wired to server)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { Screen, Text } from '../../components/ui';
import { MessageBubble } from '../../components/MessageBubble';
import { PTTButton } from '../../components/PTTButton';
import { Colors } from '../../constants/colors';
import { useWebSocket } from '../../hooks/useWebSocket';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://72.60.155.227:4000';
const WS_URL = API_URL.replace('http', 'ws');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type PipelineState = 'ready' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

const STATE_LABELS: Record<PipelineState, string> = {
  ready: 'Prêt',
  listening: 'Écoute...',
  transcribing: 'Transcription...',
  thinking: 'Réflexion...',
  speaking: 'Parle...',
};

export default function ConversationScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pipelineState, setPipelineState] = useState<PipelineState>('ready');
  const [textInput, setTextInput] = useState('');
  const [pttState, setPttState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Get auth token
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  // WebSocket connection
  const { lastMessage, send, connectionState } = useWebSocket({
    url: `${WS_URL}/ws`,
    token: token ?? undefined,
    autoReconnect: true,
  });

  // Handle server messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'state_change':
        setPipelineState(mapState(lastMessage.state as string));
        break;
      case 'transcript':
        addMessage('user', lastMessage.text as string);
        break;
      case 'text_response':
        addMessage('assistant', lastMessage.text as string);
        if (!(lastMessage.isPartial as boolean)) setPipelineState('ready');
        break;
      case 'audio_chunk':
        // TODO: play audio via expo-av
        if (lastMessage.isLast) setPipelineState('ready');
        break;
      case 'error':
        addMessage('assistant', `⚠️ ${lastMessage.message as string}`);
        setPipelineState('ready');
        break;
    }
  }, [lastMessage]);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handlePTTStart = useCallback(() => {
    setPttState('recording');
    setPipelineState('listening');
    // TODO: start audio recording (usePTT hook + expo-av)
  }, []);

  const handlePTTEnd = useCallback(() => {
    setPttState('processing');
    setPipelineState('transcribing');
    // TODO: send recorded audio chunks via WebSocket
    // send({ type: 'audio_end' });
    setPttState('idle');
  }, []);

  const handleSendText = useCallback(() => {
    if (!textInput.trim()) return;
    const text = textInput.trim();
    addMessage('user', text);
    setTextInput('');
    setPipelineState('thinking');

    // Send text message via WebSocket
    send({ type: 'text', text });
  }, [textInput, addMessage, send]);

  return (
    <Screen padded={false}>
      <View style={styles.container}>
        {/* Connection indicator */}
        {connectionState !== 'connected' && (
          <View style={styles.connectionBanner}>
            <Text style={styles.connectionText}>
              {connectionState === 'connecting' ? '🔄 Connexion...' : '❌ Déconnecté'}
            </Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <MessageBubble role={item.role} content={item.content} timestamp={item.timestamp} />
          )}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text variant="heading" color={Colors.primary} style={styles.emptyEmoji}>🌅</Text>
              <Text variant="subheading" style={styles.emptyTitle}>Salut !</Text>
              <Text variant="body" color={Colors.textLight} style={styles.emptyText}>
                Maintiens le bouton pour parler, ou tape un message.
              </Text>
            </View>
          }
        />

        {/* Pipeline state */}
        {pipelineState !== 'ready' && (
          <View style={styles.stateIndicator}>
            <Text style={styles.stateText}>{STATE_LABELS[pipelineState]}</Text>
          </View>
        )}

        {/* Input area */}
        <View style={styles.inputArea}>
          <View style={styles.textInputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Tape un message..."
              placeholderTextColor={Colors.textLight}
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
            />
            {textInput.trim() ? (
              <TouchableOpacity onPress={handleSendText} style={styles.sendButton}>
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <PTTButton
            state={pttState}
            onPressIn={handlePTTStart}
            onPressOut={handlePTTEnd}
          />
        </View>
      </View>
    </Screen>
  );
}

function mapState(state: string): PipelineState {
  const map: Record<string, PipelineState> = {
    RECEIVING_AUDIO: 'listening',
    TRANSCRIBING: 'transcribing',
    THINKING: 'thinking',
    EXECUTING_ACTION: 'thinking',
    SYNTHESIZING: 'speaking',
    STREAMING_AUDIO: 'speaking',
    COMPLETED: 'ready',
  };
  return map[state] ?? 'ready';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  connectionBanner: { backgroundColor: '#FFE4B5', padding: 8, alignItems: 'center' },
  connectionText: { fontSize: 13, color: '#8B6914' },
  messageList: { padding: 16, paddingBottom: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 120 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { marginBottom: 8 },
  emptyText: { textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
  stateIndicator: { alignItems: 'center', paddingVertical: 8, backgroundColor: Colors.accent + '20' },
  stateText: { fontSize: 14, color: Colors.secondary, fontWeight: '600' },
  inputArea: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12, gap: 12, backgroundColor: '#fff' },
  textInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textInput: { flex: 1, backgroundColor: Colors.background, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: Colors.text },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
