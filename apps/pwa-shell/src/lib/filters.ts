export type Filters = { 
  category: string[]; 
  updatedSince?: string; 
  availability?: "any"|"cached"|"online" 
}
