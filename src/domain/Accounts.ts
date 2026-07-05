// Core domain objects and logic
export class AccountDomain {
  id: string;
  name: string;
  type: string;

  constructor(id: string, name: string, type: string) {
    this.id = id;
    this.name = name;
    this.type = type;
  }
}
