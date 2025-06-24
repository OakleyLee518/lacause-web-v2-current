export const meanArray = (array: number[], dim: number) => {
  const flatArray = array.flat(dim - 1)
  return flatArray.reduce((sum, val) => sum + val, 0) / flatArray.length
}

export const stdArray = (array: number[], dim: number) => {
  const flatArray = array.flat(dim - 1)
  const mean = flatArray.reduce((sum, val) => sum + val, 0) / flatArray.length;
  return Math.sqrt(flatArray.reduce((sum, val) => sum + (val - mean) ** 2, 0) / flatArray.length);
}

export const operate3DArray = (a: number[][][], b: number[][][] | number, op = "+") => {
  return a.map((layer, i) => 
    layer.map((row, j) => 
      row.map((value, k) => {
        const bv = typeof b === "number" ? b : b[i][j][k]
        if (op === "+") {
          return value + bv
        } else if (op === "-") {
          return value - bv
        } else if (op === "/") {
          return value / bv
        } else {
          return value * bv
        }
      })
    )
  )
}

export const operate4DArray = (a: number[][][][], b: number[][][][] | number, op = "+") => {
  return a.map((layer1, i) => 
    layer1.map((layer2, j) => 
      layer2.map((layer3, k) => 
        layer3.map((value, p) => {
          const bv = typeof b === "number" ? b : b[i][j][k][p]
          if (op === "+") {
            return value + bv
          } else if (op === "-") {
            return value - bv
          } else if (op === "/") {
            return value / bv
          } else {
            return value * bv
          }
        })
      )
    )
  )
}

export const cumsum = (arr: number[]) => {
  let sum = 0;
  return arr.map(value => sum += value);
}

export const nanmean = (arr:number[]) => {
  const filtered = arr.filter(val => !isNaN(val)); // Remove NaN values
  if (filtered.length === 0) return NaN; // Return NaN if all values are NaN
  const sum = filtered.reduce((acc, val) => acc + val, 0);
  return sum / filtered.length;
}

export const nanStd = (arr:number[], ddof = 1) => {
  const filtered = arr.filter(val => !isNaN(val)); // Remove NaN values
  const n = filtered.length;
  if (n === 0 || n - ddof <= 0) return NaN; // Return NaN if not enough values

  const mean = filtered.reduce((acc, val) => acc + val, 0) / n; // Mean
  const variance =
    filtered.reduce((acc, val) => acc + (val - mean) ** 2, 0) / (n - ddof); // Variance

  return Math.sqrt(variance); // Standard deviation
}

export const nansum = (arr:number[]) => {
  return arr.filter(val => !isNaN(val)).reduce((acc, val) => acc + val, 0)
}

export const arange = (start:number, stop:number, step:number) => {
  const result = [];
  for (let i = start; i < stop; i += step) {
    result.push(i);
  }
  return result;
}

export const average = (arr: number[]): number => {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}