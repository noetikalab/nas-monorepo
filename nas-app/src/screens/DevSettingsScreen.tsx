import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {storage} from '../storage/local';
import type {RootStackParamList} from '../navigation';
import {c, spacing} from '../theme/tokens';
import {shared} from '../theme/shared';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DevSettings'>;
};

export function DevSettingsScreen({navigation}: Props) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    storage.getServerUrl().then(setUrl);
  }, []);

  const handleSave = async () => {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed.startsWith('http')) {
      Alert.alert('Invalid URL', 'Must start with http:// or https://');
      return;
    }
    await storage.saveServerUrl(trimmed);
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <Text style={shared.title}>Dev Settings</Text>
      <Text style={[shared.label, styles.labelGap]}>Server URL</Text>
      <TextInput
        style={[shared.input, styles.inputGap]}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.x.x:8080"
        placeholderTextColor={c.mutedForeground}
      />
      <TouchableOpacity style={shared.btn} onPress={handleSave}>
        <Text style={shared.btnText}>Save & Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: 80,
    backgroundColor: c.background,
  },
  labelGap: {marginTop: spacing.xl},
  inputGap: {marginBottom: 20},
});
