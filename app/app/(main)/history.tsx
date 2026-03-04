/**
 * US-008 — History Screen
 * Display conversation history with swipe-to-delete
 */
import React, { useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { useHistory, HistoryEntry } from '../../hooks/useHistory';
import { useTheme } from '../../constants/theme';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DELETE_THRESHOLD = 80;

interface SwipeableItemProps {
  item: HistoryEntry;
  onDelete: (id: string) => void;
  theme: ReturnType<typeof useTheme>;
}

function SwipeableItem({ item, onDelete, theme }: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panX = useRef(0);

  const handleTouchStart = (e: any) => {
    panX.current = e.nativeEvent.pageX;
  };

  const handleTouchMove = (e: any) => {
    const diff = e.nativeEvent.pageX - panX.current;
    if (diff < 0) {
      // Swiping left
      translateX.setValue(Math.max(diff, -DELETE_THRESHOLD));
    }
  };

  const handleTouchEnd = () => {
    const currentValue = (translateX as any)._value;
    if (currentValue < -DELETE_THRESHOLD / 2) {
      // Show delete button
      Animated.spring(translateX, {
        toValue: -DELETE_THRESHOLD,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer',
      'Supprimer cette conversation ?',
      [
        { text: 'Annuler', style: 'cancel', onPress: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }},
        { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(item.id) },
      ]
    );
  };

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <View style={styles.swipeContainer}>
      {/* Delete background */}
      <TouchableOpacity 
        style={[styles.deleteAction, { backgroundColor: theme.error }]}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
      
      {/* Swipeable content */}
      <Animated.View
        style={[
          styles.itemWrapper,
          { transform: [{ translateX }] },
        ]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <View style={[styles.item, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.time, { color: theme.textMuted }]}>
            {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: fr })}
          </Text>
          <Text style={[styles.user, { color: theme.text }]}>
            🧑 {truncate(item.userText, 100)}
          </Text>
          <Text style={[styles.assistant, { color: theme.textSecondary }]}>
            ✨ {truncate(item.assistantText, 150)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function HistoryScreen() {
  const theme = useTheme();
  const { history, remove, clear, loading } = useHistory();

  const handleClearAll = () => {
    if (history.length === 0) return;
    
    Alert.alert(
      'Tout effacer',
      'Supprimer tout l\'historique ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Effacer', style: 'destructive', onPress: clear },
      ]
    );
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => (
    <SwipeableItem item={item} onDelete={remove} theme={theme} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyEmoji]}>💬</Text>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>
        Aucune conversation
      </Text>
      <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
        Tes échanges avec Diva apparaîtront ici
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (history.length === 0) return null;
    
    return (
      <View style={[styles.header, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.headerText, { color: theme.textSecondary }]}>
          {history.length} conversation{history.length > 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={[styles.clearText, { color: theme.error }]}>
            Tout effacer
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <Screen>
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            Chargement...
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={history.length === 0 ? styles.emptyList : styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingBottom: 32,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 14,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
  },
  swipeContainer: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 12,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_THRESHOLD,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  deleteText: {
    fontSize: 24,
  },
  itemWrapper: {
    backgroundColor: 'transparent',
  },
  item: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  time: {
    fontSize: 12,
    marginBottom: 8,
  },
  user: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  assistant: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
});
