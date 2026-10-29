-- ========================================================================
-- MSG OILFIELD EQUIPMENT TRADING LLC
-- AUTOMATED STOCK MANAGEMENT, HEAT TRACEABILITY & MTC MANAGEMENT SYSTEM
-- Production-Ready Database Migration & Schema
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------
-- 1. PROFILES & USER ROLES
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'Active' CHECK (account_status IN ('Active', 'Inactive', 'Suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN (
        'super_admin',
        'admin_inventory',
        'sales_team',
        'storekeeper',
        'mtc_controller',
        'dispatch_team',
        'management_viewer'
    )),
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

-- ------------------------------------------------------------------------
-- 2. CUSTOMERS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    address TEXT,
    contact_details TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 3. ITEMS (Item Master)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code TEXT UNIQUE NOT NULL,
    item_description TEXT NOT NULL,
    material_grade TEXT,
    specification TEXT,
    size TEXT,
    uom TEXT NOT NULL DEFAULT 'PCS',
    unit_price_aed NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 4. STOCK LOTS (Independent Heat Traceability Lots)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    heat_number TEXT NOT NULL,
    yom INTEGER, -- Year of Manufacturing
    original_qty INTEGER NOT NULL CHECK (original_qty >= 0),
    received_qty INTEGER NOT NULL CHECK (received_qty >= 0),
    purchase_type TEXT NOT NULL CHECK (purchase_type IN ('regular', 'local_purchase')),
    supplier_name TEXT NOT NULL,
    l_code TEXT, -- Unique L-Code for Local Purchases
    stock_receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse_location TEXT NOT NULL,
    mtc_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_lot_heat_item UNIQUE (item_id, heat_number, warehouse_location, l_code)
);

-- ------------------------------------------------------------------------
-- 5. STOCK BALANCES
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_lot_id UUID UNIQUE NOT NULL REFERENCES public.stock_lots(id) ON DELETE CASCADE,
    physical_qty INTEGER NOT NULL DEFAULT 0 CHECK (physical_qty >= 0),
    reserved_qty INTEGER NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    available_qty INTEGER NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
    dispatched_qty INTEGER NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_balances CHECK (available_qty = (physical_qty - reserved_qty))
);

-- ------------------------------------------------------------------------
-- 6. SALES ORDERS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    so_number TEXT UNIQUE NOT NULL,
    po_number TEXT,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_delivery_date DATE,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN (
        'Draft',
        'Stock Allocated',
        'Pending Storekeeper Approval',
        'Approved',
        'MTC Pending',
        'MTC Generated',
        'Partially Dispatched',
        'Dispatched',
        'Cancelled'
    )),
    created_by UUID REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
    cancellation_date TIMESTAMPTZ,
    cancellation_reason TEXT,
    store_remarks TEXT,
    mtc_package_generated BOOLEAN DEFAULT FALSE,
    mtc_package_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 7. SALES ORDER ITEMS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id),
    required_qty INTEGER NOT NULL CHECK (required_qty > 0),
    allocated_qty INTEGER NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
    dispatched_qty INTEGER NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
    uom TEXT NOT NULL DEFAULT 'PCS',
    line_status TEXT NOT NULL DEFAULT 'Pending' CHECK (line_status IN ('Pending', 'Allocated', 'Approved', 'Dispatched', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 8. STOCK ALLOCATIONS (Heat Number Reservations)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    stock_lot_id UUID NOT NULL REFERENCES public.stock_lots(id),
    heat_number TEXT NOT NULL,
    allocated_qty INTEGER NOT NULL CHECK (allocated_qty > 0),
    released_qty INTEGER NOT NULL DEFAULT 0 CHECK (released_qty >= 0),
    dispatched_qty INTEGER NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
    allocation_status TEXT NOT NULL DEFAULT 'Allocated' CHECK (allocation_status IN ('Allocated', 'Released', 'Dispatched')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 9. MTC CERTIFICATES
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mtc_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.items(id),
    stock_lot_id UUID NOT NULL REFERENCES public.stock_lots(id),
    heat_number TEXT NOT NULL,
    l_code TEXT,
    yom INTEGER,
    certificate_reference TEXT NOT NULL,
    original_file_path TEXT NOT NULL,
    stamped_file_path TEXT,
    purchase_type TEXT NOT NULL CHECK (purchase_type IN ('regular', 'local_purchase')),
    supplier_name TEXT NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES public.profiles(id),
    verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified', 'Rejected')),
    approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
    pages INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 10. LOCAL PURCHASE RECORDS (L-Codes)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.local_purchase_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    l_code TEXT UNIQUE NOT NULL,
    item_id UUID NOT NULL REFERENCES public.items(id),
    stock_lot_id UUID NOT NULL REFERENCES public.stock_lots(id),
    supplier_name TEXT NOT NULL,
    purchase_reference TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    received_qty INTEGER NOT NULL CHECK (received_qty > 0),
    yom INTEGER,
    mtc_certificate_id UUID REFERENCES public.mtc_certificates(id),
    supplier_mtc_uploaded BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 11. STOCK MOVEMENTS (Immutable Ledger)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_lot_id UUID NOT NULL REFERENCES public.stock_lots(id),
    item_code TEXT NOT NULL,
    heat_number TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'Opening Stock',
        'Stock Receipt',
        'Reservation',
        'Reservation Release',
        'Dispatch',
        'Approved Customer Return',
        'Stock Adjustment',
        'Adjustment Reversal'
    )),
    quantity INTEGER NOT NULL,
    reference_type TEXT, -- e.g., 'SalesOrder', 'ManualAdjustment', 'CustomerReturn'
    reference_id TEXT,
    previous_balance INTEGER NOT NULL,
    new_balance INTEGER NOT NULL,
    performed_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT
);

-- ------------------------------------------------------------------------
-- 12. APPROVAL RECORDS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    approval_type TEXT NOT NULL,
    approval_status TEXT NOT NULL CHECK (approval_status IN ('Approved', 'Rejected', 'Correction Requested')),
    approved_by UUID REFERENCES public.profiles(id),
    approval_date TIMESTAMPTZ DEFAULT NOW(),
    rejection_reason TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 13. DISPATCH RECORDS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id),
    dispatch_reference TEXT UNIQUE NOT NULL,
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_note_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    dispatched_by UUID REFERENCES public.profiles(id),
    delivery_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 14. AUDIT LOGS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    record_id TEXT NOT NULL,
    previous_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

-- ------------------------------------------------------------------------
-- 15. EXCEL IMPORT JOBS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.excel_import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id),
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    import_type TEXT NOT NULL CHECK (import_type IN ('Master Stock', 'Sales Orders', 'MTC Registry')),
    total_rows INTEGER NOT NULL DEFAULT 0,
    successful_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Failed', 'Completed with Errors')),
    validation_report JSONB
);

-- ========================================================================
-- STORED PROCEDURES & BUSINESS TRANSACTION FUNCTIONS
-- ========================================================================

-- A. FIFO Heat Allocation Function
CREATE OR REPLACE FUNCTION public.fn_allocate_stock_fifo(
    p_sales_order_id UUID,
    p_sales_order_item_id UUID,
    p_item_id UUID,
    p_required_qty INTEGER,
    p_performed_by TEXT
) RETURNS JSONB AS $$
DECLARE
    v_lot RECORD;
    v_remaining INTEGER := p_required_qty;
    v_alloc_qty INTEGER;
    v_total_avail INTEGER;
    v_result JSONB := '[]'::JSONB;
BEGIN
    -- Check total available quantity for this item
    SELECT COALESCE(SUM(b.available_qty), 0) INTO v_total_avail
    FROM public.stock_balances b
    JOIN public.stock_lots l ON b.stock_lot_id = l.id
    WHERE l.item_id = p_item_id AND b.available_qty > 0;

    IF v_total_avail < p_required_qty THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', format('Insufficient stock. Required: %s, Available: %s', p_required_qty, v_total_avail)
        );
    END IF;

    -- Allocate FIFO: Order by stock_receipt_date ASC, then yom ASC, then id ASC
    FOR v_lot IN
        SELECT l.id, l.heat_number, b.physical_qty, b.reserved_qty, b.available_qty
        FROM public.stock_lots l
        JOIN public.stock_balances b ON l.id = b.stock_lot_id
        WHERE l.item_id = p_item_id AND b.available_qty > 0
        ORDER BY l.stock_receipt_date ASC, l.yom ASC, l.id ASC
        FOR UPDATE OF b
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_alloc_qty := LEAST(v_remaining, v_lot.available_qty);

        -- Update Stock Balance
        UPDATE public.stock_balances
        SET reserved_qty = reserved_qty + v_alloc_qty,
            available_qty = available_qty - v_alloc_qty,
            updated_at = NOW()
        WHERE stock_lot_id = v_lot.id;

        -- Insert Stock Allocation Record
        INSERT INTO public.stock_allocations (
            sales_order_item_id, sales_order_id, stock_lot_id, heat_number, allocated_qty, allocation_status
        ) VALUES (
            p_sales_order_item_id, p_sales_order_id, v_lot.id, v_lot.heat_number, v_alloc_qty, 'Allocated'
        );

        -- Record Stock Movement
        INSERT INTO public.stock_movements (
            stock_lot_id, item_code, heat_number, movement_type, quantity, reference_type, reference_id,
            previous_balance, new_balance, performed_by, remarks
        ) VALUES (
            v_lot.id,
            (SELECT item_code FROM public.items WHERE id = p_item_id),
            v_lot.heat_number,
            'Reservation',
            v_alloc_qty,
            'SalesOrder',
            p_sales_order_id::TEXT,
            v_lot.available_qty,
            v_lot.available_qty - v_alloc_qty,
            p_performed_by,
            format('FIFO allocation for SO item %s', p_sales_order_item_id)
        );

        v_result := v_result || jsonb_build_object(
            'stock_lot_id', v_lot.id,
            'heat_number', v_lot.heat_number,
            'allocated_qty', v_alloc_qty
        );

        v_remaining := v_remaining - v_alloc_qty;
    END LOOP;

    -- Update sales order item allocated_qty
    UPDATE public.sales_order_items
    SET allocated_qty = allocated_qty + p_required_qty,
        line_status = 'Allocated'
    WHERE id = p_sales_order_item_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'allocated', v_result
    );
END;
$$ LANGUAGE plpgsql;

-- B. Manual Heat Allocation Function
CREATE OR REPLACE FUNCTION public.fn_allocate_stock_manual(
    p_sales_order_id UUID,
    p_sales_order_item_id UUID,
    p_stock_lot_id UUID,
    p_qty INTEGER,
    p_performed_by TEXT
) RETURNS JSONB AS $$
DECLARE
    v_lot RECORD;
BEGIN
    SELECT l.id, l.item_id, l.heat_number, b.available_qty, b.physical_qty
    INTO v_lot
    FROM public.stock_lots l
    JOIN public.stock_balances b ON l.id = b.stock_lot_id
    WHERE l.id = p_stock_lot_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Selected stock lot does not exist.');
    END IF;

    IF v_lot.available_qty < p_qty THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', format('Insufficient stock in Heat %s. Required: %s, Available: %s', v_lot.heat_number, p_qty, v_lot.available_qty)
        );
    END IF;

    -- Update Stock Balance
    UPDATE public.stock_balances
    SET reserved_qty = reserved_qty + p_qty,
        available_qty = available_qty - p_qty,
        updated_at = NOW()
    WHERE stock_lot_id = p_stock_lot_id;

    -- Insert Allocation
    INSERT INTO public.stock_allocations (
        sales_order_item_id, sales_order_id, stock_lot_id, heat_number, allocated_qty, allocation_status
    ) VALUES (
        p_sales_order_item_id, p_sales_order_id, p_stock_lot_id, v_lot.heat_number, p_qty, 'Allocated'
    );

    -- Record Movement
    INSERT INTO public.stock_movements (
        stock_lot_id, item_code, heat_number, movement_type, quantity, reference_type, reference_id,
        previous_balance, new_balance, performed_by, remarks
    ) VALUES (
        p_stock_lot_id,
        (SELECT item_code FROM public.items WHERE id = v_lot.item_id),
        v_lot.heat_number,
        'Reservation',
        p_qty,
        'SalesOrder',
        p_sales_order_id::TEXT,
        v_lot.available_qty,
        v_lot.available_qty - p_qty,
        p_performed_by,
        format('Manual heat allocation for SO item %s', p_sales_order_item_id)
    );

    UPDATE public.sales_order_items
    SET allocated_qty = allocated_qty + p_qty,
        line_status = 'Allocated'
    WHERE id = p_sales_order_item_id;

    RETURN jsonb_build_object('success', TRUE, 'allocated_qty', p_qty, 'heat_number', v_lot.heat_number);
END;
$$ LANGUAGE plpgsql;

-- C. Cancel Sales Order Function with Safeguards
CREATE OR REPLACE FUNCTION public.fn_cancel_sales_order(
    p_sales_order_id UUID,
    p_reason TEXT,
    p_performed_by TEXT
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_alloc RECORD;
    v_released_qty INTEGER;
BEGIN
    SELECT * INTO v_order FROM public.sales_orders WHERE id = p_sales_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Sales order not found.');
    END IF;

    IF v_order.status = 'Cancelled' THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order is already cancelled.');
    END IF;

    -- If order was fully dispatched, prevent automatic stock restoration
    IF v_order.status = 'Dispatched' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Fully dispatched orders cannot be automatically restored. An approved Return transaction is required.'
        );
    END IF;

    -- Release all outstanding (undispatched) allocations
    FOR v_alloc IN
        SELECT a.*, b.available_qty, b.physical_qty, l.item_id
        FROM public.stock_allocations a
        JOIN public.stock_balances b ON a.stock_lot_id = b.stock_lot_id
        JOIN public.stock_lots l ON a.stock_lot_id = l.id
        WHERE a.sales_order_id = p_sales_order_id AND a.allocation_status = 'Allocated'
        FOR UPDATE OF b
    LOOP
        v_released_qty := v_alloc.allocated_qty - v_alloc.dispatched_qty;

        IF v_released_qty > 0 THEN
            -- Restore available balance, decrease reserved
            UPDATE public.stock_balances
            SET reserved_qty = reserved_qty - v_released_qty,
                available_qty = available_qty + v_released_qty,
                updated_at = NOW()
            WHERE stock_lot_id = v_alloc.stock_lot_id;

            -- Update allocation record to Released while preserving history
            UPDATE public.stock_allocations
            SET released_qty = v_released_qty,
                allocation_status = 'Released',
                updated_at = NOW()
            WHERE id = v_alloc.id;

            -- Log movement
            INSERT INTO public.stock_movements (
                stock_lot_id, item_code, heat_number, movement_type, quantity, reference_type, reference_id,
                previous_balance, new_balance, performed_by, remarks
            ) VALUES (
                v_alloc.stock_lot_id,
                (SELECT item_code FROM public.items WHERE id = v_alloc.item_id),
                v_alloc.heat_number,
                'Reservation Release',
                v_released_qty,
                'SalesOrderCancellation',
                p_sales_order_id::TEXT,
                v_alloc.available_qty,
                v_alloc.available_qty + v_released_qty,
                p_performed_by,
                format('Order cancelled: %s. Reserved stock released.', p_reason)
            );
        END IF;
    END LOOP;

    -- Update order status
    UPDATE public.sales_orders
    SET status = 'Cancelled',
        cancellation_date = NOW(),
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_sales_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Sales order cancelled and outstanding reservations released.'
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtc_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_purchase_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_import_jobs ENABLE ROW LEVEL SECURITY;

-- Helper security function to get current user role
CREATE OR REPLACE FUNCTION public.fn_current_user_role() RETURNS TEXT AS $$
    SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Master read policy for all authenticated users
CREATE POLICY p_authenticated_read_all_items ON public.items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_stock ON public.stock_lots FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_balances ON public.stock_balances FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_orders ON public.sales_orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_order_items ON public.sales_order_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_allocations ON public.stock_allocations FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_mtc ON public.mtc_certificates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_local ON public.local_purchase_records FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_movements ON public.stock_movements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_approvals ON public.approval_records FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_authenticated_read_dispatches ON public.dispatch_records FOR SELECT TO authenticated USING (TRUE);

-- Super admin and inventory manager write policies
CREATE POLICY p_admin_all_items ON public.items FOR ALL TO authenticated
USING (public.fn_current_user_role() IN ('super_admin', 'admin_inventory'));

CREATE POLICY p_admin_all_stock ON public.stock_lots FOR ALL TO authenticated
USING (public.fn_current_user_role() IN ('super_admin', 'admin_inventory'));

-- Sales team order creation
CREATE POLICY p_sales_insert_orders ON public.sales_orders FOR INSERT TO authenticated
WITH CHECK (public.fn_current_user_role() IN ('super_admin', 'sales_team', 'admin_inventory'));

-- Storekeeper approval write
CREATE POLICY p_storekeeper_approval ON public.approval_records FOR INSERT TO authenticated
WITH CHECK (public.fn_current_user_role() IN ('super_admin', 'storekeeper'));

-- Dispatch team dispatch write
CREATE POLICY p_dispatch_write ON public.dispatch_records FOR INSERT TO authenticated
WITH CHECK (public.fn_current_user_role() IN ('super_admin', 'dispatch_team'));

-- MTC controller certificate write
CREATE POLICY p_mtc_write ON public.mtc_certificates FOR ALL TO authenticated
USING (public.fn_current_user_role() IN ('super_admin', 'mtc_controller', 'admin_inventory'));
