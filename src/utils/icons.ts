import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const CATEGORY_ICON_OPTIONS = [
  "ShoppingCart",
  "ShoppingBasket",
  "Shirt",
  "HeartPulse",
  "Train",
  "Home",
  "Zap",
  "Flame",
  "Droplets",
  "Wifi",
  "Shield",
  "Baby",
  "BookOpen",
  "Gamepad2",
  "Star",
  "Gift",
  "UtensilsCrossed",
  "CarFront",
  "ReceiptText",
  "MoreHorizontal",
] as const;

export const CATEGORY_COLOR_OPTIONS = [
  "#C97B63",
  "#D68C45",
  "#D5A740",
  "#7E9C68",
  "#5D948A",
  "#6A84C3",
  "#8A73BE",
  "#B8739A",
  "#D46A6A",
  "#7A7A7A",
] as const;

export function resolveIcon(name?: string, fallback = "MoreHorizontal"): LucideIcon {
  const iconMap = Icons as unknown as Record<string, LucideIcon>;
  return iconMap[name ?? ""] ?? iconMap[fallback] ?? Icons.MoreHorizontal;
}
