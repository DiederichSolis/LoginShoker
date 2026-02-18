
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wlvoatmxdnklltekcjda.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indsdm9hdG14ZG5rbGx0ZWtjamRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAzMTY5NCwiZXhwIjoyMDc5NjA3Njk0fQ.QEViQB4X3E9U98ZCf7vXeqZcvlWdekKpvN7sx4BPbLk';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function inspect() {
    console.log('--- INSPECTING DATABASE ---');

    // 1. Get Active Sorteo
    const { data: sorteo, error: errSorteo } = await supabase
        .from('sorteos')
        .select('*')
        .eq('activo', true)
        .single();

    if (errSorteo) {
        console.error('Error fetching sorteo:', errSorteo);
        return;
    }
    console.log('Active Sorteo:', sorteo);

    // 2. Get Commission Configs for this Sorteo
    const { data: configs, error: errConfig } = await supabase
        .from('configuracion_porcentajes')
        .select('*')
        .eq('id_sorteo', sorteo.id_sorteo);

    console.log('Commission Configs for Sorteo:', configs);

    // 3. Find User 'josue'
    const { data: users, error: errUser } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('nombre', '%josue%'); // Assuming name matches josue

    if (!users || users.length === 0) {
        console.log("No user found with name 'josue'");
    } else {
        const josue = users[0];
        console.log('User Josue:', josue);

        // 4. Check Sales for Josue in this Sorteo
        const { count: salesCount, error: errSales } = await supabase
            .from('numeros')
            .select('*', { count: 'exact', head: true })
            .eq('id_vendedor', josue.id_usuario)
            .eq('id_sorteo', sorteo.id_sorteo);

        console.log(`Sales for Josue in Sorteo ${sorteo.id_sorteo}:`, salesCount);

        // 5. Check Ledger Movements for Josue
        const { data: movements, error: errMov } = await supabase
            .from('movimientos_balance')
            .select('*')
            .eq('usuario_id', josue.id_usuario);
        // .eq('id_sorteo', sorteo.id_sorteo); // Movements might not have sorteo_id depending on when created

        console.log('Ledger Movements for Josue:', movements);
    }
}

inspect();
