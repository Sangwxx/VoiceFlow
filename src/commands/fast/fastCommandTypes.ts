export type FastCommandName =
  | 'undo'
  | 'redo'
  | 'fit_view'
  | 'zoom_in'
  | 'zoom_out'
  | 'layout_top_down'
  | 'layout_left_to_right'
  | 'apply_layout'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'list_versions'
  | 'save_version'
  | 'export_json'
  | 'export_svg'
  | 'export_png';

export type FastCommandMatch = {
  command: FastCommandName;
  confidence: number;
};
