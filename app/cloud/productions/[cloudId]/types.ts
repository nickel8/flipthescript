export interface SceneElementData {
  id: string; // scene_elements.id
  element: {
    id: string;
    name: string;
    category: string;
  };
}

export interface SheetData {
  id: string;
  synopsis: string;
  notes: string;
  is_reviewed: boolean;
  scene_elements: SceneElementData[];
}

export interface SceneData {
  id: string;
  cloud_id: string;
  scene_number: string;
  slug_line: string;
  int_ext: string;
  location: string;
  time_of_day: string;
  page_start: number;
  is_complete: boolean;
  shoot_day: number;
  shoot_order: number;
  sheet: SheetData | null;
}

export interface ProductionElement {
  id: string;
  name: string;
  category: string;
}

export interface TodoData {
  id: string;
  title: string;
  is_done: boolean;
  scene_cloud_id: string | null;
}

export interface ShootDayData {
  dayNumber: number;
  shootDate: string | null; // ISO "YYYY-MM-DD"
}
