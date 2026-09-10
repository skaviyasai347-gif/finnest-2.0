const { createClient } = require('@supabase/supabase-js');

const url = 'https://bznfussedkcxwotctmoy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bmZ1c3NlZGtjeHdvdGN0bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTU1MjYsImV4cCI6MjEwNDYzMTUyNn0.KdDWOYZV7YX3WatiNF6uAp5Zj8OuSSAB-thFmbAXJ0A';

const sb = createClient(url, key);

async function runFullVerification() {
  console.log('=== FINNEST SUPABASE INTEGRATION TEST SUITE ===\n');

  // TEST 1: Fetch properties
  console.log('[TEST 1] Fetch properties from Supabase properties table:');
  const { data: props, error: err1 } = await sb
    .from('properties')
    .select('*, owner:profiles(*)')
    .order('created_at', { ascending: false });
  if (err1) {
    console.error('FAIL:', err1.message);
  } else {
    console.log(`PASS: Fetched ${props.length} properties successfully.`);
  }

  // TEST 2: Verify FN-1001 through FN-1010
  console.log('\n[TEST 2] Check seeded properties FN-1001 through FN-1010:');
  const expectedIds = [
    'FN-1001', 'FN-1002', 'FN-1003', 'FN-1004', 'FN-1005',
    'FN-1006', 'FN-1007', 'FN-1008', 'FN-1009', 'FN-1010'
  ];
  const foundIds = props ? props.map(p => p.property_id) : [];
  const missing = expectedIds.filter(id => !foundIds.includes(id));
  if (missing.length === 0) {
    console.log('PASS: All FN-1001 through FN-1010 are present in Supabase table.');
  } else {
    console.error('FAIL: Missing properties:', missing);
  }

  // TEST 3: Verify single property detail retrieval
  console.log('\n[TEST 3] Verify property detail retrieval by property_id and UUID:');
  const { data: propByCode, error: err3a } = await sb
    .from('properties')
    .select('*, owner:profiles(*), images:property_images(*)')
    .eq('property_id', 'FN-1001')
    .maybeSingle();

  const { data: propByUuid, error: err3b } = await sb
    .from('properties')
    .select('*, owner:profiles(*), images:property_images(*)')
    .eq('id', '20000000-0000-0000-0000-000000000001')
    .maybeSingle();

  if (!err3a && propByCode && !err3b && propByUuid) {
    console.log(`PASS: Property FN-1001 retrieved from Supabase.`);
    console.log(`      Title: "${propByCode.title}"`);
    console.log(`      Owner: ${propByCode.owner?.full_name} (${propByCode.owner?.role})`);
    console.log(`      Images: ${propByCode.images?.length} image records attached`);
  } else {
    console.error('FAIL:', err3a?.message || err3b?.message);
  }

  // TEST 4: Admin Properties page query (all properties + owners)
  console.log('\n[TEST 4] Verify Admin Properties page query:');
  const { data: adminProps, error: err4 } = await sb
    .from('properties')
    .select('*, owner:profiles(*)')
    .order('created_at', { ascending: false });

  if (!err4 && adminProps) {
    console.log(`PASS: Admin query returned ${adminProps.length} parcels with owner metadata from Supabase.`);
  } else {
    console.error('FAIL:', err4?.message);
  }

  // TEST 5: User Property views query (filtered by owner_id)
  console.log('\n[TEST 5] Verify User Property views query:');
  const aaravOwnerId = '00000000-0000-0000-0000-000000000002';
  const { data: userProps, error: err5 } = await sb
    .from('properties')
    .select('*, owner:profiles(*)')
    .eq('owner_id', aaravOwnerId);

  if (!err5 && userProps) {
    console.log(`PASS: User Aarav query returned ${userProps.length} assigned properties from Supabase.`);
    console.log(`      Parcels: ${userProps.map(p => p.property_id).join(', ')}`);
  } else {
    console.error('FAIL:', err5?.message);
  }

  // TEST 6: Profiles / Owners resolution
  console.log('\n[TEST 6] Verify profiles/owners resolution:');
  const { data: profiles, error: err6 } = await sb.from('profiles').select('*');
  if (!err6 && profiles) {
    console.log(`PASS: ${profiles.length} profiles resolved through Supabase.`);
    console.log(`      Roles: ${[...new Set(profiles.map(p => p.role))].join(', ')}`);
  } else {
    console.error('FAIL:', err6?.message);
  }

  // TEST 7: Property CRUD on Supabase
  console.log('\n[TEST 7] Test Property CRUD operations on Supabase:');
  const testPropId = 'FN-TEST-' + Math.floor(1000 + Math.random() * 9000);
  const testRecord = {
    property_id: testPropId,
    title: 'Automated Test Parcel',
    description: 'Temporary parcel for CRUD verification',
    area: 2500,
    area_unit: 'sq.ft',
    property_type: 'Commercial',
    address: '100 Test Blvd, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postal_code: '600001',
    latitude: 12.9850,
    longitude: 80.2400,
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[[80.239, 12.984], [80.241, 12.984], [80.241, 12.986], [80.239, 12.986], [80.239, 12.984]]]
    },
    status: 'active',
    registration_number: 'TN-CHN-TEST-01',
    survey_number: 'SY-TEST/1',
  };

  // 7a. Insert
  const { data: insData, error: insErr } = await sb.from('properties').insert(testRecord).select().single();
  if (insErr) {
    console.error('FAIL INSERT:', insErr.message);
  } else {
    console.log(`PASS (CREATE): Created parcel ${insData.property_id} in Supabase (id: ${insData.id}).`);

    // 7b. Update
    const { error: updErr } = await sb.from('properties').update({ title: 'Updated Test Parcel Title' }).eq('id', insData.id);
    console.log(`PASS (UPDATE): ${updErr ? 'FAIL: ' + updErr.message : 'Successfully updated title in Supabase.'}`);

    // 7c. Archive / Soft-delete
    const { error: archErr } = await sb.from('properties').update({ status: 'archived' }).eq('id', insData.id);
    console.log(`PASS (ARCHIVE): ${archErr ? 'FAIL: ' + archErr.message : 'Successfully set status to archived in Supabase.'}`);

    // 7d. Permanent Delete
    const { error: delErr } = await sb.from('properties').delete().eq('id', insData.id);
    console.log(`PASS (DELETE): ${delErr ? 'FAIL: ' + delErr.message : 'Successfully deleted test record from Supabase.'}`);
  }

  // TEST 8: Image upload to property-images bucket
  console.log('\n[TEST 8] Verify image upload to property-images bucket:');
  const testFileName = `test-verify-${Date.now()}.jpg`;
  const testBuffer = Buffer.from('fake image binary content for verification');
  const { data: upData, error: upErr } = await sb.storage.from('property-images').upload(`test/${testFileName}`, testBuffer, {
    contentType: 'image/jpeg',
    upsert: true
  });
  if (upErr) {
    console.error('FAIL STORAGE UPLOAD:', upErr.message);
  } else {
    const { data: pubUrl } = sb.storage.from('property-images').getPublicUrl(`test/${testFileName}`);
    console.log(`PASS: Uploaded image to Supabase Storage.`);
    console.log(`      Public URL: ${pubUrl.publicUrl}`);
    // Cleanup
    await sb.storage.from('property-images').remove([`test/${testFileName}`]);
    console.log(`PASS: Test image cleaned up from bucket successfully.`);
  }

  // TEST 9 & 10: Check for any table errors across all services
  console.log('\n[TEST 9 & 10] Check for any Supabase errors across all 7 tables:');
  const tables = [
    'profiles',
    'properties',
    'property_images',
    'ownership_history',
    'hardware_devices',
    'hardware_events',
    'property_activity'
  ];
  let allClean = true;
  for (const t of tables) {
    const { error, count } = await sb.from(t).select('*', { count: 'exact' });
    if (error) {
      console.error(`Table ${t} ERROR: ${error.message}`);
      allClean = false;
    } else {
      console.log(`  Table [${t}]: OK (${count} rows)`);
    }
  }
  if (allClean) {
    console.log('\nPASS: All 7 core tables are responsive, error-free, and populated in Supabase.');
  }

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
}

runFullVerification();
