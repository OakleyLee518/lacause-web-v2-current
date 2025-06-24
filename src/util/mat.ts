export const spdiags = (data: number[][], diags: number[], m: number, n: number) => {
  const rst = Array(m).fill(0).map(() => Array(n).fill(0))
  for (let i = 0; i < data.length; i++) {
    const diag = data[i];
    const offset = diags[i];
    
    for (let j = 0; j < diag.length; j++) {
      const row = j - offset;
      const col = j;
      
      // Only add if within matrix bounds
      if (row >= 0 && row < m && col >= 0 && col < n) {
        rst[row][col] = diag[j];
      }
    }
  }
  return rst
}