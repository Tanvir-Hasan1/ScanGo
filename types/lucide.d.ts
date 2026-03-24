declare module 'lucide-react-native' {
  import { ForwardRefExoticComponent } from 'react';
  import { SvgProps } from 'react-native-svg';
  
  interface LucideProps extends SvgProps {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
    'data-testid'?: string;
  }
  
  export const IdCard: ForwardRefExoticComponent<LucideProps>;
  export const Settings: ForwardRefExoticComponent<LucideProps>;
}
