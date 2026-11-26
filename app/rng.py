"""确定性线性同余随机数生成器（LCG）。

完全复刻前端 app.js 的随机逻辑：
    let _seed = 20261125;
    rnd() { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; }
    pick(a) = a[Math.floor(rnd() * a.length)]
    ri(a, b) = a + Math.floor(rnd() * (b - a + 1))
"""

DEFAULT_SEED = 20261125
MODULUS = 4294967296
MULTIPLIER = 1664525
INCREMENT = 1013904223


class LCG:
    """与前端逐位一致的 LCG 随机源。"""

    def __init__(self, seed: int = DEFAULT_SEED) -> None:
        self._seed = seed % MODULUS

    def reset(self, seed: int = DEFAULT_SEED) -> None:
        """重置种子（对应前端 `_seed = 20261125`）。"""
        self._seed = seed % MODULUS

    @property
    def seed(self) -> int:
        return self._seed

    def rnd(self) -> float:
        """返回 [0, 1) 区间的确定性浮点数。"""
        self._seed = (self._seed * MULTIPLIER + INCREMENT) % MODULUS
        return self._seed / MODULUS

    def pick(self, seq):
        """从序列中等概率取一个元素。"""
        return seq[int(self.rnd() * len(seq))]

    def ri(self, a: int, b: int) -> int:
        """返回 [a, b] 闭区间内的确定性整数。"""
        return a + int(self.rnd() * (b - a + 1))


# 全局共享实例，种子生成顺序必须与前端 defaultState() 一致：
# platforms -> orders -> inventory -> syncLogs
rng = LCG(DEFAULT_SEED)
