/**
 * A-48: price lists per currency. A list can price in a currency other than the home one; an
 * invoice picks the list in its own currency; a customer may be on one list per currency. Lists
 * saved without a currency keep their meaning (the home currency).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { customerPricer, listCurrency, listForCustomer, listPrice, priceListsProblem, type PriceList } from '../lib/priceLists';

const home: PriceList = { id: 'pl_home0001', name: 'Wholesale', discountPercent: 10, customerIds: ['cus_a'] };
const euro: PriceList = { id: 'pl_euro0001', name: 'Euro retail', currency: 'EUR', prices: { chair: 4500 }, discountPercent: 5, customerIds: ['cus_a', 'cus_b'] };

describe('A-48 price lists per currency', () => {
  test('a list without a currency prices in the home currency, exactly as before', () => {
    assert.equal(listCurrency(home), 'USD');
    assert.equal(listCurrency(home, 'ILS'), 'ILS');
    assert.equal(listForCustomer([home], 'cus_a')?.id, 'pl_home0001');
    assert.equal(listForCustomer([home], 'cus_a', undefined, 'USD')?.id, 'pl_home0001');
  });

  test('an invoice in EUR picks the EUR list for the same customer, and USD keeps the home list', () => {
    const lists = [home, euro];
    assert.equal(listForCustomer(lists, 'cus_a', 'EUR')?.id, 'pl_euro0001');
    assert.equal(listForCustomer(lists, 'cus_a', 'USD')?.id, 'pl_home0001');
    assert.equal(listForCustomer(lists, 'cus_a')?.id, 'pl_home0001', 'no currency given means the home currency');
  });

  test('a customer with only a EUR list gets no price for a USD invoice', () => {
    assert.equal(listForCustomer([euro], 'cus_b', 'USD'), undefined);
    assert.equal(customerPricer([euro], 'cus_b', 'USD'), undefined);
    const priced = customerPricer([euro], 'cus_b', 'EUR');
    assert.equal(priced?.({ id: 'chair', unitPriceCents: 9000 }), 4500, 'the listed price, in the list currency');
    assert.equal(priced?.({ id: 'desk', unitPriceCents: 10000 }), 9500, 'the discount applies in whole cents');
  });

  test('the home currency can be named explicitly: a list in USD is the home list', () => {
    const usd: PriceList = { id: 'pl_usd00001', name: 'Dollar list', currency: 'USD', discountPercent: 3, customerIds: ['cus_c'] };
    assert.equal(listForCustomer([usd], 'cus_c', undefined, 'USD')?.id, 'pl_usd00001');
    assert.match(String(priceListsProblem([usd, { ...home, customerIds: ['cus_c'] }], 'USD')), /on both/, 'a USD list and a home-currency list are both USD: one per customer');
  });

  test('one list per customer per currency: a customer may be on a EUR list and a USD list', () => {
    assert.equal(priceListsProblem([home, euro]), null);
    assert.match(String(priceListsProblem([euro, { ...euro, id: 'pl_euro0002', name: 'Euro two', customerIds: ['cus_a'] }])), /on both "Euro retail" and "Euro two"/, 'two EUR lists for one customer are refused');
  });

  test('two lists for one customer in the same currency are still refused, as before', () => {
    const other: PriceList = { id: 'pl_other001', name: 'Other', discountPercent: 2, customerIds: ['cus_a'] };
    assert.match(String(priceListsProblem([home, other])), /on both "Wholesale" and "Other"/);
  });

  test('a currency must be a three-letter code', () => {
    assert.match(String(priceListsProblem([{ ...euro, currency: 'euro' }])), /three-letter code/);
    assert.match(String(priceListsProblem([{ ...euro, currency: 'EURO' }])), /three-letter code/);
    assert.equal(priceListsProblem([{ ...euro, currency: undefined }]), null);
  });

  test('a EUR list keeps its own prices and discount', () => {
    assert.equal(listPrice(euro, { id: 'desk', unitPriceCents: 10000 }), 9500);
    assert.equal(listPrice(euro, { id: 'chair', unitPriceCents: 1 }), 4500);
  });
});
