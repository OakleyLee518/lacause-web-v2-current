export class CubicSpline {
    constructor(x, y) {
        if (x.length !== y.length) {
            throw new Error("x and y arrays must have the same length");
        }
        if (x.length < 3) {
            throw new Error("At least three points are required for cubic interpolation");
        }

        this.n = x.length;
        this.x = x;
        this.y = y;
        this.a = [...y]; // Coefficients a_i are just the y values
        this.b = new Array(this.n - 1).fill(0);
        this.c = new Array(this.n).fill(0);
        this.d = new Array(this.n - 1).fill(0);

        this.computeSplineCoefficients();
    }

    computeSplineCoefficients() {
        const n = this.n;
        const h = new Array(n - 1);
        const alpha = new Array(n - 1);
        const l = new Array(n);
        const mu = new Array(n);
        const z = new Array(n);

        // Compute h and alpha
        for (let i = 0; i < n - 1; i++) {
            h[i] = this.x[i + 1] - this.x[i];
            if (h[i] === 0) throw new Error("x values must be distinct");
        }
        for (let i = 1; i < n - 1; i++) {
            alpha[i] = (3 / h[i]) * (this.a[i + 1] - this.a[i]) - (3 / h[i - 1]) * (this.a[i] - this.a[i - 1]);
        }

        // Forward elimination (Tridiagonal system)
        l[0] = 1;
        mu[0] = 0;
        z[0] = 0;
        for (let i = 1; i < n - 1; i++) {
            l[i] = 2 * (this.x[i + 1] - this.x[i - 1]) - h[i - 1] * mu[i - 1];
            mu[i] = h[i] / l[i];
            z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
        }

        // Back substitution
        l[n - 1] = 1;
        z[n - 1] = 0;
        this.c[n - 1] = 0;
        for (let j = n - 2; j >= 0; j--) {
            this.c[j] = z[j] - mu[j] * this.c[j + 1];
            this.b[j] = (this.a[j + 1] - this.a[j]) / h[j] - (h[j] * (this.c[j + 1] + 2 * this.c[j])) / 3;
            this.d[j] = (this.c[j + 1] - this.c[j]) / (3 * h[j]);
        }
    }

    interpolate(xVal) {
        // Find the correct interval
        let i = this.x.length - 2;
        while (i > 0 && xVal < this.x[i]) {
            i--;
        }

        const dx = xVal - this.x[i];
        return this.a[i] + this.b[i] * dx + this.c[i] * dx ** 2 + this.d[i] * dx ** 3;
    }

    interpolateArray(xVals) {
        return xVals.map((xVal) => {
            return this.interpolate(xVal)
        })
        
    }
}

export const signalInterpolate = (xValues, yValues, xNew) => {
    if (xValues.length === 0) {
        return []
    }
    // If only one value, return a constant signal
    if (xValues.length === 1) {
        return Array(xNew.length).fill(yValues[0])
    }

    // if x_values is identical to x_new, no need for interpolation
    if (JSON.stringify(xValues) === JSON.stringify(xNew)) {
        return yValues
    } else if (xValues.some((val, index) => index > 0 && val === xValues[index - 1])) {
        [xValues, yValues] = _signalInterpolateAverageDuplicates(xValues, yValues)
    }

    const spline = new CubicSpline(xValues, yValues)
    let interpolated = spline.interpolateArray(xNew)
    return interpolated
}

const _signalInterpolateAverageDuplicates = (xValues, yValues) => {
    let [uniqueX, indices] = uniqueWithInverse(xValues)
    let tmp = bincount(indices)
    let meanY = bincount(indices, yValues).map((v, i) => v / tmp[i])
    return uniqueX, meanY
}


const uniqueWithInverse = (arr) => {
    // Get unique values and sort them
    const uniqueSorted = [...new Set(arr)].sort((a, b) => a - b);
  
    // Map each original value to its index in the sorted unique array
    const indices = arr.map(val => uniqueSorted.indexOf(val));
  
    return [uniqueSorted, indices];
}

const bincount = (indices, weights) => {
    if (weights === null || weights === undefined) {
        weights = Array(indices.length).fill(1)
    }
    const counts = new Array(Math.max(...indices) + 1).fill(0);
    const sums = new Array(Math.max(...indices) + 1).fill(0);
  
    // Accumulate sums and counts
    indices.forEach((idx, i) => {
      sums[idx] += weights[i];
      counts[idx] += 1;
    });
  
    // Compute means (handling division by zero)
    return sums.map((sum, i) => (counts[i] ? sum: 0));
}
