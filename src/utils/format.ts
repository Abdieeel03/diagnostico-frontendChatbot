// Format disease name to be more user-friendly (e.g. otitis_media -> Otitis Media)
export const formatDiseaseName = (name: string): string => {
  if (!name) return "";
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
