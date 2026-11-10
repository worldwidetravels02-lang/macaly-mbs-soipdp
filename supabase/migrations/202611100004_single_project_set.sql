-- Keep all projects in one catalogue set after removing Set 2 and Set 3.
-- Existing Set 2 and Set 3 properties are moved into Set 1 so customers
-- continue to see every published property.
update public.properties
set set_number = 1
where set_number is distinct from 1;
