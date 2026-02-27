import { spacingTokens, type AppTheme } from "@nospoilers/ui";
import { Card, Flex, Section, Text } from "@radix-ui/themes";

type NotificationEvent = { id: string; type: string; createdAt: string; text: string };

export const NotificationsScreen = ({ theme, events }: { theme: AppTheme; events: NotificationEvent[] }) => (
  <Section size="1" style={{ padding: 0 }}>
    {/* Use a simple vertical Radix layout so every notification reads like a consistent feed item. */}
    <Flex direction="column" gap="2" style={{ animation: "slideInFromLeft 220ms ease-out" }}>
      <style>{"@keyframes slideInFromLeft{from{opacity:.6;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}"}</style>
      {events.map((event) => (
        <Card key={event.id} variant="surface" style={{ border: `1px solid ${theme.colors.border}` }}>
          <div style={{ padding: 12 }}>
            <Flex direction="column" gap="1">
              <Text weight="bold" size="2" style={{ color: theme.colors.textPrimary }}>
                {event.type}
              </Text>
              <Text size="2" style={{ color: theme.colors.textSecondary }}>
                {event.text}
              </Text>
              <Text size="1" style={{ color: theme.colors.textSecondary, marginTop: spacingTokens.xs }}>
                {new Date(event.createdAt).toLocaleString()}
              </Text>
            </Flex>
          </div>
        </Card>
      ))}
    </Flex>
  </Section>
);
