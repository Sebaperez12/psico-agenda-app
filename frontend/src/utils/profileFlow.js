export function getPostLoginTarget(user) {
  if (!user?.has_profile) {
    return "/profile";
  }

  return "/appointments";
}

export function updateOfficeAddressList(currentAddresses = [], nextValue = "") {
  const trimmedValue = nextValue.trim();
  if (!trimmedValue) {
    return [...currentAddresses];
  }

  const withoutValue = currentAddresses.filter((address) => address.trim() !== trimmedValue);
  const nextAddresses = [trimmedValue, ...withoutValue].slice(0, 5);

  while (nextAddresses.length < 5) {
    nextAddresses.push("");
  }

  return nextAddresses;
}
