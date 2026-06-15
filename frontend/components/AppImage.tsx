import { Image, ImageContentFit, ImageSource } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';

interface Props {
  uri?: string | null;
  source?: ImageSource | number;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  placeholder?: string;
}

export default function AppImage({ uri, source, style, contentFit = 'cover', placeholder }: Readonly<Props>) {
  const resolvedSource = source ?? (uri ? { uri } : null);
  const isRemote = !!uri && !source;
  return (
    <Image
      source={resolvedSource}
      style={[isRemote && { backgroundColor: '#F1F5F9' }, style]}
      contentFit={contentFit}
      cachePolicy="disk"
      placeholder={placeholder}
      transition={200}
    />
  );
}
