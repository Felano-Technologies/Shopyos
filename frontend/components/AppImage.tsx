import { Image, ImageContentFit, ImageSource, ImageLoadEventData, ImageErrorEventData } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';

interface Props {
  uri?: string | null;
  source?: ImageSource | number;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  placeholder?: string;
  onLoadStart?: () => void;
  onLoad?: (event: ImageLoadEventData) => void;
  onLoadEnd?: () => void;
  onError?: (event: ImageErrorEventData) => void;
}

export default function AppImage({
  uri,
  source,
  style,
  contentFit = 'cover',
  placeholder,
  onLoadStart,
  onLoad,
  onLoadEnd,
  onError,
}: Readonly<Props>) {
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
      onLoadStart={onLoadStart}
      onLoad={onLoad}
      onLoadEnd={onLoadEnd}
      onError={onError}
    />
  );
}
