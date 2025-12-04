import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Pagination helper - extracts data from paginated response
export function extractPaginatedData<T>(response: any): T[] {
  // If response is already an array, return it (backward compatibility)
  if (Array.isArray(response)) {
    return response;
  }
  // If response has a data property, return that
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data || [];
  }
  return [];
}
