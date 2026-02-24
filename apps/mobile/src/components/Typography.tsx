import { forwardRef } from "react";
import { Text, TextInput, type TextInputProps, type TextProps } from "react-native";
import { typographyTokens } from "@nospoilers/ui";

const baseTypographyStyle = {
  fontFamily: typographyTokens.family
} as const;

export const AppText = ({ style, ...props }: TextProps) => <Text {...props} style={[baseTypographyStyle, style]} />;

export const AppTextInput = forwardRef<TextInput, TextInputProps>(({ style, ...props }, ref) => (
  <TextInput ref={ref} {...props} style={[baseTypographyStyle, style]} />
));

AppTextInput.displayName = "AppTextInput";
