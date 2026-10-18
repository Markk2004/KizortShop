export class UpdateMemberProfileDto {
  displayName?: string;
  avatarUrl?: string;
}

export class MemberChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}
