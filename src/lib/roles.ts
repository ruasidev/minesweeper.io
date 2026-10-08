// An account's role is a comma-separated list, so it can hold more than one
export const isAdminRole = (role: string | null | undefined): boolean => role?.split(",").includes("admin") ?? false
