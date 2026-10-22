/** Paleta para materias: tonos distinguibles entre sí sobre fondo claro y oscuro. */
export const SUBJECT_COLORS = [
  { value: "#2B4ACB", label: "Azul tinta" },
  { value: "#1F7A99", label: "Petróleo" },
  { value: "#2F8F6B", label: "Verde" },
  { value: "#8A7A2E", label: "Oliva" },
  { value: "#D9480F", label: "Naranja" },
  { value: "#C2255C", label: "Frambuesa" },
  { value: "#8B4FB3", label: "Violeta" },
  { value: "#5C6577", label: "Grafito" },
] as const;

export const DEFAULT_SUBJECT_COLOR = SUBJECT_COLORS[0].value;
