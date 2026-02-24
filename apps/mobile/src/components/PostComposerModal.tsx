import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { AppText } from "./Typography";

type Option = { id: string; label: string };
type Attachment = { url: string; kind: "image" | "video"; bytes: number };

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export const PostComposerModal = ({ visible, theme, groups, catalogItems, progressUnits, onClose, onSubmit }: {
  visible: boolean;
  theme: AppTheme;
  groups: Option[];
  catalogItems: Option[];
  progressUnits: Option[];
  onClose: () => void;
  onSubmit: (payload: { body_text: string; public: boolean; group_id: string | null; catalog_item_id: string | null; progress_unit_id: string | null; tenor_gif_url: string | null; tenor_gif_id: string | null; attachments: Attachment[] }) => Promise<void>;
}) => {
  const [bodyText, setBodyText] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [catalogItemId, setCatalogItemId] = useState<string>("");
  const [progressUnitId, setProgressUnitId] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  const [tenorQuery, setTenorQuery] = useState("");
  const [tenorGifId, setTenorGifId] = useState("");
  const [tenorGifUrl, setTenorGifUrl] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const lockPublic = !groupId;
  const computedPublic = lockPublic ? true : isPublic;
  const tenorResults = useMemo(() => tenorQuery.trim() ? Array.from({ length: 3 }).map((_, idx) => ({ id: `${tenorQuery}-${idx + 1}`, url: `https://tenor.com/view/${tenorQuery}-${idx + 1}`, label: `${tenorQuery} GIF ${idx + 1}` })) : [], [tenorQuery]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
          <AppText style={{ color: theme.colors.textPrimary, fontWeight: "700", fontSize: 18 }}>Create post</AppText>
          <TextInput multiline maxLength={500} value={bodyText} onChangeText={setBodyText} placeholder="Write something spoiler-safe..." placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]} />
          <AppText style={{ color: theme.colors.textSecondary }}>{bodyText.length}/500</AppText>
          <AppText style={{ color: theme.colors.textSecondary }}>Group: {groups.find((g) => g.id === groupId)?.label ?? "None"}</AppText>
          <View style={styles.row}>{groups.slice(0, 4).map((group) => <Pressable key={group.id} onPress={() => setGroupId(group.id)} style={[styles.pill, { borderColor: theme.colors.border }]}><AppText>{group.label}</AppText></Pressable>)}<Pressable onPress={() => setGroupId("")} style={[styles.pill, { borderColor: theme.colors.border }]}><AppText>None</AppText></Pressable></View>
          <AppText style={{ color: theme.colors.textSecondary }}>Catalog: {catalogItems.find((item) => item.id === catalogItemId)?.label ?? "None"}</AppText>
          <View style={styles.row}>{catalogItems.slice(0, 4).map((item) => <Pressable key={item.id} onPress={() => setCatalogItemId(item.id)} style={[styles.pill, { borderColor: theme.colors.border }]}><AppText>{item.label}</AppText></Pressable>)}</View>
          <AppText style={{ color: theme.colors.textSecondary }}>Progress unit: {progressUnits.find((unit) => unit.id === progressUnitId)?.label ?? "None"}</AppText>
          <View style={styles.row}>{progressUnits.slice(0, 4).map((unit) => <Pressable key={unit.id} onPress={() => setProgressUnitId(unit.id)} style={[styles.pill, { borderColor: theme.colors.border }]}><AppText>{unit.label}</AppText></Pressable>)}</View>
          <View style={styles.toggleRow}><AppText style={{ color: theme.colors.textPrimary }}>Public</AppText><Switch value={computedPublic} onValueChange={setIsPublic} disabled={lockPublic} /></View>
          {lockPublic ? <AppText style={{ color: theme.colors.textSecondary }}>Visibility is locked to public because no group is selected.</AppText> : null}
          <TextInput value={tenorQuery} onChangeText={setTenorQuery} placeholder="Search Tenor GIF" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]} />
          <View style={styles.row}>{tenorResults.map((item) => <Pressable key={item.id} onPress={() => { setTenorGifId(item.id); setTenorGifUrl(item.url); }} style={[styles.pill, { borderColor: theme.colors.border }]}><AppText>{item.label}</AppText></Pressable>)}</View>
          <AppText style={{ color: theme.colors.textSecondary }}>Media picker mock enforces 10MB max per attachment.</AppText>
          <View style={styles.row}>
            <Pressable
              onPress={() => setAttachments([{ url: "sample-image.jpg", kind: "image", bytes: MAX_MEDIA_BYTES - 1 }])}
              style={[styles.pill, { borderColor: theme.colors.border }]}
            >
              <AppText>Add sample image</AppText>
            </Pressable>
            <Pressable
              onPress={() => {
                const attempted = [{ url: "too-large.mp4", kind: "video" as const, bytes: MAX_MEDIA_BYTES + 1 }];
                setAttachments(attempted.filter((file) => file.bytes <= MAX_MEDIA_BYTES));
              }}
              style={[styles.pill, { borderColor: theme.colors.border }]}
            >
              <AppText>{"Try >10MB video"}</AppText>
            </Pressable>
          </View>
          <View style={styles.footer}><Pressable onPress={onClose}><AppText>Cancel</AppText></Pressable><Pressable onPress={async () => { await onSubmit({ body_text: bodyText, public: computedPublic, group_id: groupId || null, catalog_item_id: catalogItemId || null, progress_unit_id: progressUnitId || null, tenor_gif_id: tenorGifId || null, tenor_gif_url: tenorGifUrl || null, attachments }); onClose(); }} style={[styles.submit, { backgroundColor: theme.colors.accent }]}><AppText style={{ color: theme.colors.accentText }}>Publish</AppText></Pressable></View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)", padding: spacingTokens.lg },
  card: { borderWidth: 1, borderRadius: radiusTokens.lg, padding: spacingTokens.md, gap: spacingTokens.sm },
  input: { borderWidth: 1, borderRadius: radiusTokens.md, minHeight: 44, paddingHorizontal: spacingTokens.sm, paddingVertical: spacingTokens.sm },
  row: { flexDirection: "row", gap: spacingTokens.sm, flexWrap: "wrap" },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacingTokens.sm, paddingVertical: 6 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: spacingTokens.md, alignItems: "center" },
  submit: { borderRadius: radiusTokens.md, paddingHorizontal: spacingTokens.md, paddingVertical: spacingTokens.sm }
});
