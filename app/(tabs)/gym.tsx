import { ExerciseDef, MASTER_EXERCISES } from '@/constants/exercises';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dualStorage } from '@/lib/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function GymScreen() {
    const { user } = useAuth();
    const { colors, accentColor } = useTheme();
    const router = useRouter();

    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [myConfig, setMyConfig] = useState<string[]>([]);

    useEffect(() => {
        loadConfig();
    }, [user]);

    const loadConfig = async () => {
        if (!user) return;
        setLoading(true);
        const configData = await dualStorage.getItem('data', 'gym_config', user.uid);
        if (configData && configData.exercises) {
            setMyConfig(configData.exercises);
        } else {
            // Default behavior context: if completely empty, default to show first 4
            setMyConfig(MASTER_EXERCISES.slice(0, 4).map(e => e.id));
        }
        setLoading(false);
    };

    const saveConfig = async () => {
        if (!user) return;
        setEditing(false); // Close edit mode instantly for better UX
        await dualStorage.setItem('data', 'gym_config', { exercises: myConfig }, user.uid);
    };

    const toggleExercise = (id: string) => {
        if (myConfig.includes(id)) {
            setMyConfig(myConfig.filter(e => e !== id));
        } else {
            setMyConfig([...myConfig, id]);
        }
    };

    const visibleExercises = MASTER_EXERCISES.filter(ex => myConfig.includes(ex.id));

    const renderEditItem = ({ item }: { item: ExerciseDef }) => (
        <View style={[styles.editRow, { borderBottomColor: colors.border }]}>
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons name={item.icon as any} size={28} color={colors.text} />
            </View>
            <View style={styles.editInfo}>
                <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.exerciseCategory, { color: colors.textMuted }]}>{item.category}</Text>
            </View>
            <Switch
                value={myConfig.includes(item.id)}
                onValueChange={() => toggleExercise(item.id)}
                trackColor={{ false: colors.border, true: accentColor }}
                thumbColor={myConfig.includes(item.id) ? '#ffffff' : '#f4f3f4'}
            />
        </View>
    );

    const renderGridItem = ({ item }: { item: ExerciseDef }) => (
        <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: accentColor }]}
            onPress={() => router.push({ pathname: '/modal', params: { exerciseId: item.id, exerciseName: item.name } })}
        >
            <MaterialCommunityIcons name={item.icon as any} size={48} color={accentColor} />
            <Text style={[styles.gridCardTitle, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.gridCardSub, { color: accentColor }]}>{item.category}</Text>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#ff4757" />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.text }]}>{editing ? 'Configure Gym' : 'My Gym'}</Text>
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                        {editing ? 'Toggle available equipment' : 'Tap an exercise to log it'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.headerButton, { backgroundColor: colors.text }]}
                    onPress={editing ? saveConfig : () => setEditing(true)}
                >
                    <Text style={[styles.headerButtonText, { color: colors.background }]}>{editing ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
            </View>

            {editing ? (
                <FlatList
                    key="list"
                    data={MASTER_EXERCISES}
                    keyExtractor={(item) => item.id}
                    renderItem={renderEditItem}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <FlatList
                    key="grid"
                    data={visibleExercises}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    renderItem={renderGridItem}
                    showsVerticalScrollIndicator={false}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Tap Edit to add your gym's equipment.</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    subtitle: {
        fontSize: 14,
        color: '#aaaaaa',
        marginTop: 4,
    },
    headerButton: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 24,
    },
    headerButtonText: {
        color: '#1a1a1a',
        fontWeight: '700',
    },
    // Edit Mode Styles
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a2a',
    },
    iconContainer: {
        width: 50,
        alignItems: 'center',
    },
    editInfo: {
        flex: 1,
        paddingLeft: 10,
    },
    exerciseName: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    exerciseCategory: {
        color: '#aaaaaa',
        fontSize: 13,
        marginTop: 2,
    },
    // Grid Mode Styles
    gridCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        padding: 24,
        marginBottom: 16,
        width: '48%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        elevation: 6,
        shadowColor: '#ff4757',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    gridCardTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 12,
    },
    gridCardSub: {
        color: '#ff4757',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    emptyText: {
        color: '#aaaaaa',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    }
});
