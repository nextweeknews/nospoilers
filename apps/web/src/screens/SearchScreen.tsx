import { type AppTheme } from "@nospoilers/ui";
import { Card, Flex, Heading, Section, Separator, Text, TextField } from "@radix-ui/themes";

type SearchItem = { id: string; title: string; chapter: string | null; episode: string | null };

export const SearchScreen = ({ theme, query, onQueryChange, results, recent, popular }: { theme: AppTheme; query: string; onQueryChange: (query: string) => void; results: SearchItem[]; recent: SearchItem[]; popular: SearchItem[] }) => (
  <Section size="1" style={{ padding: 0, animation: "slideInFromLeft 220ms ease-out" }}>
    <style>{"@keyframes slideInFromLeft{from{opacity:.6;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}"}</style>
    <Flex direction="column" gap="3">
      {/* Switch to Radix TextField so search input gets consistent focus and spacing behavior. */}
      <TextField.Root
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search by title, chapter, or episode"
      />
      {query ? (
        <Card variant="surface" style={{ border: `1px solid ${theme.colors.border}` }}>
          <div style={{ padding: 12 }}>
            <Flex direction="column" gap="2">
              {results.map((item) => (
                <Text key={item.id} size="2" style={{ color: theme.colors.textPrimary }}>
                  {item.title} {item.chapter ? `· ${item.chapter}` : ""} {item.episode ? `· ${item.episode}` : ""}
                </Text>
              ))}
            </Flex>
          </div>
        </Card>
      ) : (
        <>
          <Card variant="surface" style={{ border: `1px solid ${theme.colors.border}` }}>
            <div style={{ padding: 12 }}>
              <Flex direction="column" gap="2">
                <Heading as="h4" size="3" style={{ margin: 0, color: theme.colors.textPrimary }}>Recent</Heading>
                {recent.map((item) => <Text key={item.id} size="2" style={{ color: theme.colors.textSecondary }}>{item.title}</Text>)}
              </Flex>
            </div>
          </Card>
          <Separator size="4" />
          <Card variant="surface" style={{ border: `1px solid ${theme.colors.border}` }}>
            <div style={{ padding: 12 }}>
              <Flex direction="column" gap="2">
                <Heading as="h4" size="3" style={{ margin: 0, color: theme.colors.textPrimary }}>Popular</Heading>
                {popular.map((item) => <Text key={item.id} size="2" style={{ color: theme.colors.textSecondary }}>{item.title}</Text>)}
              </Flex>
            </div>
          </Card>
        </>
      )}
    </Flex>
  </Section>
);
