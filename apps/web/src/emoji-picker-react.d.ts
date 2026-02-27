declare module "emoji-picker-react" {
  import type { ComponentType } from "react";

  export type EmojiClickData = {
    emoji: string;
  };

  export type EmojiPickerProps = {
    onEmojiClick?: (emojiData: EmojiClickData) => void;
  };

  const EmojiPicker: ComponentType<EmojiPickerProps>;
  export default EmojiPicker;
}
