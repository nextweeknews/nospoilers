import { useMemo, useState } from "react";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Avatar, Badge, Button, Card, DataList, DropdownMenu, Flex, Text } from "@radix-ui/themes";
import { spacingTokens, type AppTheme } from "@nospoilers/ui";

type GroupMember = {
  userId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string;
  role: "owner" | "admin" | "member";
};

type GroupSettingsScreenProps = {
  theme: AppTheme;
  groupName: string;
  currentUserId: string;
  groupMembers: GroupMember[];
  isOwner: boolean;
  onViewProfile: (userId: string) => void;
  onReportUser: (userId: string) => void;
  onConfirmDangerAction: () => void;
};

export const GroupSettingsScreen = ({
  theme,
  groupName,
  currentUserId,
  groupMembers,
  isOwner,
  onViewProfile,
  onReportUser,
  onConfirmDangerAction
}: GroupSettingsScreenProps) => {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [openMemberMenuId, setOpenMemberMenuId] = useState<string | null>(null);
  const [hoveredMemberMenuButtonId, setHoveredMemberMenuButtonId] = useState<string | null>(null);

  // Group settings should always keep owners and admins toward the top so moderation context is immediately visible.
  const sortedMembers = useMemo(() => {
    const rolePriority: Record<GroupMember["role"], number> = { owner: 0, admin: 1, member: 2 };
    return [...groupMembers].sort((a, b) => {
      const roleDelta = rolePriority[a.role] - rolePriority[b.role];
      if (roleDelta !== 0) return roleDelta;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [groupMembers]);

  return (
    <Flex direction="column" gap="4">
      <Card>
        <DataList.Root>
          {sortedMembers.map((member) => {
            const isHovered = hoveredMemberId === member.userId;
            const isOpen = openMemberMenuId === member.userId;
            return (
              <DataList.Item
                key={member.userId}
                align="center"
                onMouseEnter={() => setHoveredMemberId(member.userId)}
                onMouseLeave={() => setHoveredMemberId((current) => (current === member.userId ? null : current))}
              >
                <DataList.Label minWidth="320px">
                  <Flex align="center" gap="3">
                    <Avatar
                      size="2"
                      src={member.avatarUrl}
                      fallback={member.displayName.charAt(0).toUpperCase()}
                      radius="full"
                    />
                    <Flex direction="column" gap="1">
                      <Text weight="medium">{member.displayName}</Text>
                      {member.username ? (
                        <Text size="1" color="gray">@{member.username}</Text>
                      ) : null}
                    </Flex>
                  </Flex>
                </DataList.Label>
                <DataList.Value>
                  {member.role === "owner" ? <Badge color="green">Owner</Badge> : null}
                  {member.role === "admin" ? <Badge color="purple">Admin</Badge> : null}
                  {member.role === "member" ? <Text size="1" color="gray">Member</Text> : null}
                </DataList.Value>
                <DataList.Value style={{ display: "flex", justifyContent: "flex-end" }}>
                  <DropdownMenu.Root open={isOpen} onOpenChange={(nextOpen) => setOpenMemberMenuId(nextOpen ? member.userId : null)}>
                    <DropdownMenu.Trigger
                      style={{
                        border: "none",
                        background: "transparent",
                        borderRadius: 999,
                        width: 24,
                        height: 24,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: isHovered || isOpen ? 1 : 0,
                        color: isOpen || hoveredMemberMenuButtonId === member.userId ? "var(--green-9)" : theme.colors.textSecondary,
                        cursor: "pointer",
                        transition: "opacity 120ms ease, color 120ms ease"
                      }}
                      onMouseEnter={() => setHoveredMemberMenuButtonId(member.userId)}
                      onMouseLeave={() => setHoveredMemberMenuButtonId((current) => (current === member.userId ? null : current))}
                    >
                      <DotsHorizontalIcon width={14} height={14} aria-hidden="true" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item onSelect={() => onViewProfile(member.userId)}>View profile</DropdownMenu.Item>
                      {member.userId !== currentUserId ? (
                        <DropdownMenu.Item color="red" onSelect={() => onReportUser(member.userId)}>Report user</DropdownMenu.Item>
                      ) : null}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </DataList.Value>
              </DataList.Item>
            );
          })}
        </DataList.Root>
      </Card>

      <Card>
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Text color="gray" size="2">
            {isOwner ? "Owners can delete the group for everyone." : "Leaving removes you from this group immediately."}
          </Text>
          <Button color="red" onClick={onConfirmDangerAction} style={{ minWidth: 140 }}>
            {isOwner ? `Delete group` : `Leave group`}
          </Button>
        </Flex>
      </Card>

      <Text size="1" color="gray" style={{ marginTop: spacingTokens.xs }}>
        Group settings for {groupName}
      </Text>
    </Flex>
  );
};
