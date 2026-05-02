// 金额安全运算：消除 IEEE 754 浮点误差，保持2位小数精度
// e.g. 0.1 + 0.2 = 0.30000000000000004 -> toMoney(0.1 + 0.2) = 0.3
function toMoney(n) {
  return Math.round((+n + Number.EPSILON) * 100) / 100;
}

module.exports = { toMoney };
