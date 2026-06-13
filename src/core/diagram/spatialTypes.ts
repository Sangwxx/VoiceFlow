export const SPATIAL_RELATIONS = ['left_of', 'right_of', 'above', 'below'] as const;
export type SpatialRelation = (typeof SPATIAL_RELATIONS)[number];

export const ALIGNMENT_AXES = ['horizontal', 'vertical'] as const;
export type AlignmentAxis = (typeof ALIGNMENT_AXES)[number];
